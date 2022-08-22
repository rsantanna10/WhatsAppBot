const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors')
const ROUTE = require('./config/route.js');
let $SERVER = null

const APP = class App {
  constructor() {
    this.server = this.express_init(), this.express_config(this.server), this.express_route(this.server)
    $SERVER = this.start_server(this.server)
    return $SERVER
  }

  express_init(){
    return express()
  }

  express_config(server) {
    server.use(bodyParser.json());
    server.use(bodyParser.urlencoded({ extended: true }))    ;
    server.use(helmet());
    server.use(cors()) // include before other routes
    
    return server;
  }

  express_route(server){
    return new ROUTE(server)
  }

  start_server(server){ 
    return server.listen(process.env.PORT || 3000, () => {
      console.log(`Server online on port ${process.env.PORT || 3000}`);
      return server
    })   
  }

  static close_server(){
    $SERVER.close()
  }
}
new APP()

module.exports = APP