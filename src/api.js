const puppeteer = require("puppeteer");
const qrcode = require("qrcode-terminal");
const { from, merge } = require('rxjs');
const { take } = require('rxjs/operators');
const path = require('path');
const rimraf = require("rimraf");
const fs = require("fs");

let browser = null;
let page = null;
let counter = { fails: 0, success: 0 }
const tmpPath = path.resolve(__dirname, '../tmp');

/**
 * Initialize browser, page and setup page desktop mode
 */
async function start({ showBrowser = false, qrCodeData = false, session = true } = {}) {
    if (!session) {
        deleteSession(tmpPath);
    }

    const args = {
        headless: !showBrowser,
        userDataDir: tmpPath,
        args: ["--no-sandbox",
            // "--blink-settings=imagesEnabled=false"]
        ]
    }
    try {
        browser = await puppeteer.launch(args);
        page = await browser.newPage();
        // prevent dialog blocking page and just accept it(necessary when a message is sent too fast)
        page.on("dialog", async dialog => { await dialog.accept(); });
        // fix the chrome headless mode true issues
        // https://gitmemory.com/issue/GoogleChrome/puppeteer/1766/482797370
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36");
        page.setDefaultTimeout(60000);

        await page.goto("https://web.whatsapp.com");
        
        if (session && await isAuthenticated()) {
            return;
        }
        else {
            if (qrCodeData) {
                console.log('Getting QRCode data...');
                console.log('Note: You should use wbm.waitQRCode() inside wbm.start() to avoid errors.');
                return await getQRCodeData();
            } else {
                await generateQRCode();
            }
        }

    } catch (err) {
        deleteSession(tmpPath);
        throw err;
    }
}

/**
 * Check if needs to scan qr code or already is is inside the chat
 */
function isAuthenticated() {
    console.log('Authenticating...');
    return  needsToScan();
}

function needsToScan() {
    return from(
        page
            .waitForSelector('body > div > div > .landing-wrapper', {
                timeout: 0,
            }).then(() => false)
    );
}

function isInsideChat() {
    return from(
        page
            .waitForFunction(`document.getElementsByClassName('h70RQ two')[0]`,
                {
                    timeout: 0,
                }).then(() => true)
    );
}

function deleteSession() {
    rimraf.sync(tmpPath);
}
/**
 * return the data used to create the QR Code
 */
async function getQRCodeData() {
    await page.waitForSelector("div[data-ref]", { timeout: 60000 });
    const qrcodeData = await page.evaluate(() => {
        let qrcodeDiv = document.querySelector("div[data-ref]");
        return qrcodeDiv.getAttribute("data-ref");
    });
    return await qrcodeData;
}

/**
 * Access whatsapp web page, get QR Code data and generate it on terminal
 */
async function generateQRCode() {
    try {
        console.log("generating QRCode...");
        const qrcodeData = await getQRCodeData();
        qrcode.generate(qrcodeData, { small: true });
        console.log("QRCode generated! Scan it using Whatsapp App.");
    } catch (err) {
        throw await QRCodeExeption("QR Code can't be generated(maybe your connection is too slow).");
    }
    await waitQRCode();
}

/**
 * Wait 30s to the qrCode be hidden on page
 */
async function waitQRCode() {
    // if user scan QR Code it will be hidden
    try {
        await page.waitForSelector("div[data-ref]", { timeout: 30000, hidden: true });
    } catch (err) {
        throw await QRCodeExeption("Dont't be late to scan the QR Code.");
    }
}

/**
 * Close browser and show an error message
 * @param {string} msg 
 */
async function QRCodeExeption(msg) {
    await browser.close();
    return "QRCodeException: " + msg;
}

/**
 * @param {string} phone phone number: '5535988841854'
 * @param {string} message Message to send to phone number
 * Send message to a phone number
 */
async function sendTo(phoneOrContact, message) {
    let phone = phoneOrContact;
    if (typeof phoneOrContact === "object") {
        phone = phoneOrContact.phone;
        message = generateCustomMessage(phoneOrContact, message);
    }
    try {
        process.stdout.write("Sending Message...\r");
		await page.waitForSelector("div#startup", { hidden: true, timeout: 60000 });
        
        await page.waitForSelector('#side', { timeout: 60000 });
        try {
            await page.waitForSelector('#contact_send', { timeout: 1000 });
        } catch (err) {
            await page.evaluate(() => {
              document.querySelector('#side').innerHTML += '<a id="contact_send" target="_blank" rel="noopener noreferrer" class="_1VzZY selectable-text invisible-space copyable-text">Enviar</a>';
            });
        }

        async function setSelectVal(sel, val) {
            page.evaluate((data) => {
                return document.querySelector(data.sel).href = data.val
            }, {sel, val})
        }
        
        await setSelectVal('#contact_send', `https://wa.me/${phone}?text=${encodeURIComponent(message)}`);

		
		const form = await page.$('a#contact_send');
		await form.evaluate( f => f.click() );

        //Verificação de número inválido
        let invalidNumber = false;
        try {
          await page.waitForSelector('div._1HX2v > div > div', { timeout: 400 });
          invalidNumber = true;
        } catch (error) {
            //Nova verificação
            try {
                await page.waitForSelector('div._3NCh_ > div > div', { timeout: 400 });
                invalidNumber = true;    
              } catch{
                invalidNumber = false;
              }
        }

        if (invalidNumber) {
            throw ('Número inválido');
        }
        
        await page.waitForSelector('div[tabindex="-1"]', { timeout: 5000 });
        await page.keyboard.press("Enter");
        await page.waitFor(1000);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - Enviado\n`);
		counter.success++;
        await sleep(120000);
        
    } catch (err) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - ${err} - Falha\n`);
        counter.fails++;
    }
}

async function send(phoneOrContacts, message) {
    for (let phoneOrContact of phoneOrContacts) {
        await sendTo(phoneOrContact.number, message.replace('{name}', phoneOrContact.name));
    }
}

/**
 * @param {array} phones Array of phone numbers: ['5535988841854', ...]
 * @param {string} message Message to send to every phone number
 * Send same message to every phone number
 */

 async function scrapperLastMessageTo(phoneOrContact) {

    const formatDateTime = (dt) => {
        let dateTimeFormat = dt.substr(0, dt.indexOf(']')).replace('[', '').replace(']', '').replace(' ', '').split(','); 
        return dateTimeFormat[1] + ' ' + dateTimeFormat[0];
    }

    let phone = phoneOrContact;
    if (typeof phoneOrContact === "object") {
        phone = phoneOrContact.phone;
    }
    try {
        process.stdout.write("Scrapping ...\r");
		await page.waitForSelector("div#startup", { hidden: true, timeout: 60000 });
        
        await page.waitForSelector('#side', { timeout: 60000 });
        try {
            await page.waitForSelector('#contact_send', { timeout: 1000 });
        } catch (err) {
            await page.evaluate(() => {
              document.querySelector('#side').innerHTML += '<a id="contact_send" target="_blank" rel="noopener noreferrer" class="_1VzZY selectable-text invisible-space copyable-text">Enviar</a>';
            });
        }

        async function setSelectVal(sel, val) {
            page.evaluate((data) => {
                return document.querySelector(data.sel).href = data.val
            }, {sel, val})
        }
        
        await setSelectVal('#contact_send', `https://wa.me/${phone}`);
		
		const form = await page.$('a#contact_send');		
        await form.evaluate( f => f.click() );

        //Verificação de número inválido
        let invalidNumber = false;
        try {
          await page.waitForSelector('div._1HX2v > div > div', { timeout: 4000 });
          invalidNumber = true;
        } catch (error) {
            //Nova verificação
            try {
                await page.waitForSelector('div._3NCh_ > div > div', { timeout: 4000 });
                invalidNumber = true;    
              } catch {
                invalidNumber = false;
              }
        }

        if (invalidNumber) {
            throw ({ type: 'NUMERO_INVALIDO', message:'Número sem WhatsApp cadastro'});
        }

        await page.waitForSelector('#main > div:nth-of-type(3) > div > div > div:nth-of-type(3)', { timeout: 10000 });

        //Verificando qual div deverá obter a mensagem
        const styleAttr = await page.$$eval("#main > div:nth-of-type(3) > div > div > div:nth-of-type(3)", el => el.map(x => x.getAttribute("style")));
        const dataValue = styleAttr[0] === "display: none;" ? '2' : '3';
                
        //Verificando se possui mensagem
        const selector = "#main > div:nth-of-type(3) > div > div > div:nth-of-type(" + dataValue + ") > div[class*='message-']";
        const divs = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(d => d.getAttribute("data-id")), selector, { timeout: 10000 });

        if (divs.length === 0) {
            throw ({ type: 'SEM_MENSAGEM', message:'Não possui mensagem para esse contato'});
        }

        const dataIdLastMessage = divs[divs.length -1];

        let dateFormat = '';
        const date = await page.$$eval("div[data-id='" + dataIdLastMessage + "'] > div > div > div > div:first-of-type", el => el.map(x => x.getAttribute("data-pre-plain-text")));
          
        if (date[0] !== null) {
            dateFormat = formatDateTime(date[0]);
        }

        const sent = dataIdLastMessage.trim().includes("true_") ? 'Enviada' : 'Recebida';

        let status = '-';
        
        if (sent === 'Enviada') {
            status = (await page.$$eval("div[data-id='" + dataIdLastMessage + "']  > div > div > div > div:last-of-type > div > div > span", el => el.map(x => x.getAttribute("aria-label"))))[0].trim();
        }

        const statusFormat = (status === 'Read' || status === 'Lida') ? 'Lida' : 
                             (status === 'Delivered' || status === 'Entregue') ? 'Entregue' : 
                             (status === 'Sent' || status === 'Enviada ') ? 'Enviada' : 
                             (status === 'Pending' || status === 'Pendente') ? 'Pendente' :
                             status === '-' ? status : 'Status não reconhecido';

        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - Scrapper OK\n`);
		counter.success++;
        return `${phone};${sent};${dateFormat};${statusFormat}\n`;
        
        
    } catch (err) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - ${err.message} - Scrapper Falha\n`);
        counter.fails++;
        if (err.type) {
            return `${phone};${err.type};;${err.message}\n`;
        } else {
            return `${phone};Erro;;${err}\n`;
        }        
    }
}

async function scrapperLastMessage(phoneOrContacts) {

    var writeStream = fs.createWriteStream("enviados-recebidos.csv");

    writeStream.write('Número;Status;Data da Ocorrência;Descrição\n');
       
    for (let phoneOrContact of phoneOrContacts) {
        const result = await scrapperLastMessageTo(phoneOrContact.number);
        writeStream.write(result);
    }

    writeStream.end();
}

/**
 * @param {object} contact contact with several properties defined by the user
 * @param {string} messagePrototype Custom message to send to every phone number
 * @returns {string} message
 * Replace all text between {{}} to respective contact property
 */
function generateCustomMessage(contact, messagePrototype) {
    let message = messagePrototype;
    for (let property in contact) {
        message = message.replace(new RegExp(`{{${property}}}`, "g"), contact[property]);
    }
    return message;
}

/**
 * Close browser and show results(number of messages sent and failed)
 */
async function end() {
    await browser.close();
    console.log(`Result: ${counter.success} sent, ${counter.fails} failed`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

module.exports = {
    start,
    send,
    sendTo,
    scrapperLastMessage,
    scrapperLastMessageTo,
    end,
    waitQRCode
}