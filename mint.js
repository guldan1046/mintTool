const ethers = require("ethers");
const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

var provider;
var chainId;
var wallet;
var loop;
var inscription_hex;
var gasPriceMax;
var extraGas;
var estimateGasLimit;
async function init(rpc, accountIndex, _loop, inscription, _gasPriceMax, _extraGas) {
    console.log("===== init =====");
    console.log("=== rpc : ", rpc);
    provider = new ethers.providers.JsonRpcProvider(rpc);
    const network = await provider.getNetwork();
    chainId = await network.chainId;
    console.log("=== chainId : ", chainId);

    inscription_hex = await ethers.utils.hexlify(ethers.utils.toUtf8Bytes(inscription));
    console.log("=== inscription_str : ", inscription);
    console.log("=== inscription_hex : ", inscription_hex);

    const mnemonic = fs.readFileSync("./mnemonic.secret", "utf8");
    let path = "m/44'/60'/0'/0/" + accountIndex;
    // var wallet = new ethers.Wallet(pvk, provider);
    wallet = ethers.Wallet.fromMnemonic(mnemonic, path);
    console.log("=== wallet : ", wallet.address);
    wallet = wallet.connect(provider);

    estimateGasLimit = await provider.estimateGas({
        to: wallet.address,
        data: inscription_hex,
    });
    // console.log("estimateGasLimit : ", estimateGasLimit);
    var txGasLimit = parseInt(estimateGasLimit, 10);
    console.log("=== tx txGasLimit ： ", txGasLimit);

    console.log("=== loop : ", _loop);
    loop = _loop;

    var gasBalance = await wallet.getBalance();
    var gasBalanceFormat = await ethers.utils.formatEther(gasBalance);
    console.log("=== gasBalanceFormat : ", gasBalanceFormat);

    console.log("=== gasPriceMax(Gwei) : ", _gasPriceMax);
    gasPriceMax = _gasPriceMax;

    console.log("=== extraGas(Gwei) : ", _extraGas);
    extraGas = _extraGas;
}

async function mint() {
    console.log("===== mint =====");
    var blockGasPriceInWei = await provider.getGasPrice();
    // console.log("blockGasPriceInWei : ", blockGasPriceInWei);
    var blockGasPriceInGwei = ethers.utils.formatUnits(blockGasPriceInWei, 9);
    console.log("=== blockGasPriceInGwei : ", blockGasPriceInGwei);

    var nonce;
    var tx;
    var signedTx;
    var rc;
    var successCount = 0;
    var failCount = 0;
    var nouceZeroCount = 0;
    for (var i = 0; i < loop; i++) {
        nonce = await wallet.getTransactionCount();
        console.log("=== nonce : ", nonce);

        if (nonce == 0 && nouceZeroCount == 0) nouceZeroCount++;
        else
            while (nonce == 0) {
                console.log(`=== 获取到无效的nonce：${nonce}...重新获取中...`);
                nonce = await wallet.getTransactionCount();
                await wait(1000);
            }

        console.log("=== nonce : ", nonce);

        // solidGas = document.getElementById("input_solid_gas").value;
        // extraGas = document.getElementById("input_extra_gas").value;
        // if (solidGas > 0) {
        //     blockGasPriceInWei = ethers.utils.parseEther(ethers.utils.formatUnits(solidGas, 9));
        // } else {
        blockGasPriceInWei = await provider.getGasPrice();
        // }
        blockGasPrice = ethers.utils.formatUnits(blockGasPriceInWei, 9);
        console.log(`=== 当前gasPrice ： ${blockGasPrice} Gwei`);

        if (parseInt(blockGasPrice, 10) == 1) {
            console.log(`=== 获取到无效的gasPrice：${blockGasPrice} Gwei, 【程序已终止】，请重试！`);
            return;
        }
        gas_price_max = gasPriceMax;
        if (parseInt(blockGasPrice, 10) > parseInt(gas_price_max, 10)) {
            console.log(
                `当前链上gas价格为：${blockGasPrice} Gwei，超过了你的设限：${gas_price_max} Gwei，【程序已终止】请等待gas降低或调高你的gas价格限制！`
            );
            return;
        }
        var solidGas = 0;
        if (solidGas == 0 && extraGas > 0)
            blockGasPriceInWei =
                parseInt(ethers.utils.parseUnits(blockGasPrice, 9), 10) +
                parseInt(ethers.utils.parseUnits(ethers.utils.formatUnits(extraGas, 0), 9), 10);
        console.log(`=== 最终使用gasPrice ： ${blockGasPriceInWei} wei`);
        console.log(`=== 最终使用gas ： ${ethers.utils.formatEther(blockGasPriceInWei * estimateGasLimit)} eth`);
        tx = {
            chainId: chainId,
            from: wallet.address,
            to: wallet.address,
            nonce: nonce,
            gasLimit: txGasLimit,
            gasPrice: blockGasPriceInWei,
            data: inscription_hex,
        };
        signedTx = await wallet.signTransaction(tx);

        console.log(`===>>> 交易_${i + 1}_正在发送 <<<===`);
        try {
            rc = await provider.sendTransaction(signedTx);
        } catch (error) {
            console.log(`===>>> 交易_${i + 1}_发生异常：${error}`);
            console.log(`===>>> 交易_${i + 1}_失败，执行跳过本次执行...`);
            failCount++;
            continue;
        }

        await rc.wait();
        console.log(`===>>> 交易_${i + 1}_已上链确认：`, rc);
        successCount++;
        await wait(2000);
    }

    console.log(`===>>> 本次执行已完成，成功【${successCount}】笔，失败【${failCount}】笔，请去区块浏览器确认！`);
}

function askQuestion(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

async function main() {
    console.log("===== main =====");

    const rpc = "https://rpc.ankr.com/klaytn";
    const accountIndex = 0;
    const loop = 2;
    const inscription = 'data:,{"p":"fair-20","op":"mint","tick":"fair","amt":"1000"}';
    const gasPriceMax = 100; //Gwei
    const extraGas = 10; //Gwei
    await init(rpc, accountIndex, loop, inscription, gasPriceMax, extraGas);

    // 不换行输出
    // 监听键入回车事件
    var yOrN = await askQuestion("是否要开始mint? y/n : ");
    console.log("=== yOrN : ", yOrN);

    if (yOrN == "y") await mint();
    else {
        console.log("取消执行，程序结束。");
        return;
    }
}

main();
