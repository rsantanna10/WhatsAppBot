const csv = require('csv-parser')
const fs = require('fs');
const wbm = require('./wbm/src/index');

(async () => {
    //Obtendo mensagem
    const message = fs.readFileSync('msg.txt', 'utf8');    

    //Obtendo contatos
    let phones = [];
    await fs.createReadStream('contatos.csv')
            .pipe(csv())
            .on('data', (data) => phones.push(data))
            .on('end', async () => {
                console.log(phones);
                await wbm.start({showBrowser: true}).then(async () => {
                await wbm.send(phones, message);
                await wbm.end();
                })
            .catch(err => console.log(err));                
    });
})();