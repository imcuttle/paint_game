/**
 * Created by Yc on 2016/5/26.
 */
var fs = require('fs');
var db = (function () {
    var file = __dirname+'/db.json';
    var db = JSON.parse(fs.readFileSync(file));
    return {
        save : function () {
            fs.writeFile(file,JSON.stringify(db,null,4));
        },
        add : function (word,tip) {
            if(db.findIndex(x=>{return x.word===word;})!=-1){
                console.error(new Error(word+' existed'));
                return false;
            }
            db.push({word:word,tip:tip});
            return true;
        },
        randomWord :function () {
            return db[Math.floor(Math.random()*db.length)];
        },
        _db:db
    }
})();

module.exports = db;