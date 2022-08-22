const csv = require('csv-parser')
const fs = require('fs');
const wbm = require('./wbm');

(async () => {
    //Obtendo contatos
    let phones = [];
    await fs.createReadStream('contatos-scrapper.csv')
            .setEncoding('UTF8')
            .pipe(csv())
            .on('data', (data) => phones.push(data))
            .on('end', async () => {
                console.log(phones);
                wbm.start().then(async () => {
                    await wbm.scrapperLastMessage(phones);
                    await wbm.end();
                })
            .catch(err => console.log(err));                
    });
})();