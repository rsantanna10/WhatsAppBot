const PORT = 3001;

module.exports = class Config {
    static port(){
        return process.env.PORT || PORT;
    }
}