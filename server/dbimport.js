/**
 * Created by Yc on 2016/5/26.
 */
var db = require('./db');
var fs = require('fs');

fs.readFile('words.txt',function (err, data) {
    if(err) throw err;
    var data = data.toString();
    data = data.split('\r\n');
    data.forEach(x=>{
        x = x.split(',');
        console.log(x);
        if(x.length===1){
            db.add(x[0],'');
        }else if(x.length>1){
            db.add(x[0],x[1]);
        }
    })
    db.save();
})
