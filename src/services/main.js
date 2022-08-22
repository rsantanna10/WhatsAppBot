const wbm = require('../wbm');

const getQrCode = (session = true) => {
    // if user scan QR Code it will be hidden
    return wbm.start({showBrowser: false, qrCodeData: true, session});
}

const scrapper = async (phones) => {

    let result = null;
    await wbm.start().then(async () => {
        result =  await wbm.scrapperLastMessage(phones);
        wbm.end();
    })

    return result;
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    getQrCode,
    scrapper,
    sleep
}