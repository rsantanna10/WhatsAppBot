const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const mainService = require('./services/main');
const wbm = require('wbm');

// defining the Express app
const app = express();

const port = process.env.PORT || 3001;

// adding Helmet to enhance your Rest API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// enabling CORS for all requests
const whitelist = ['http://localhost:3000', 'https://app-scrapper-whatsapp.herokuapp.com']
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) callback(null, true)
    else callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}

app.use(cors(corsOptions))

app.get('/qrCode', (req, res) => {
  mainService.getQrCode(req.query.session).then((data) => {
    
    if (data === true) {
      wbm.end();
      return res.status(200).send({qrcode: true});
    }
       
    wbm.end(true);    
    return res.status(200).send({qrcode: false, data});    
  });
});

app.post('/scrapper', async (req, res) => {
  const data = await mainService.scrapper(req.body);
  return res.status(200).send(data);
});

// starting the server
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});