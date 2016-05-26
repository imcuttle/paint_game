/**
 * Created by Yc on 2016/5/21.
 */
var httpd = require('http').createServer(handler);
var io = require('socket.io').listen(httpd);
var fs = require('fs');
var db = require('./db');
httpd.listen(4000);

function handler(req,res) {
    fs.readFile(__dirname+'/static/'+(req.url==='/'?'index.html':req.url),
        function (err,data) {
            if(err){
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200);
            res.end(data);
        }
    );
}



var paths = [];
var tops = (function () {
    var _tops = [],idmap={},n=10;
    return {
        set : function (id,name,v) {
            if(this.isExists(id))
                this.remove(id);
            var i = _tops.findIndex(x=>{return idmap[x].v<v;});
            i= i===-1 ? _tops.length : i;
            _tops.splice(i,0,id);
            idmap[id] = {name:name,v:v};
        },
        isExists : function (id) {
            return idmap[id]!=null;
        },
        remove : function (id) {
            var i = _tops.indexOf(id);
            if(i!==-1) {
                _tops.splice(i, 1);
                delete idmap[id];
                return true;
            }
            return false;
        },
        get:function (id) {
            return idmap[id];
        },
        toJSON:function () {
            var arr = [];
            _tops.every((x,i)=>{
                if(i>=n) return false;
                arr.push({id:x,v:idmap[x].v,name:idmap[x].name});
                return true;
            });
            return arr;
        }
    }
}());


function doCmd(msg,socket) {
    if(msg[0]==='#'){
        var msg = msg.substring(1),
            sockets = getSockets(socket);
        switch (msg) {
            case 'show paths':
                socket.emit('cmd',JSON.stringify(paths));
                socket.emit('server msg','指令操作成功！');
                return true;
            case 'show users':
                socket.emit('cmd',JSON.stringify(sockets.map(x=>x=x.name)));
                socket.emit('server msg','指令操作成功！');
                return true;
            case 'clear paths':
                paths = [];
                socket.emit('server msg','指令操作成功！');
                socket.emit('paint paths',JSON.stringify(paths));
                return true;
            case 'show word':
                socket.emit('server msg','指令操作成功！');
                socket.emit('cmd',JSON.stringify(Game.player?Game.player.word:null));
                return true;
            case 'show words':
                socket.emit('server msg','指令操作成功！');
                socket.emit('cmd',JSON.stringify(db._db));
                return true;
        }
        if(msg.startsWith('add word')){
            var s = msg.substring(8).trim();
            s = s.split(' ');
            if(s.length===2){
                if(db.add(s[0],s[1])) {
                    db.save();
                    socket.emit('server msg', '指令操作成功！');
                }
                else
                    socket.emit('server msg','指令操作失败。');
            }else
                socket.emit('server msg','指令操作失败！');
        }else{
            return false;
        }
        return true;
    }else{
        return false;
    }
}

function escapeHTML(data) {
    var s = '';
    for(var i = 0 ;i<data.length;i++){
        var d = data[i];
        switch (d){
            case '"':
                d = '&quot;'; break;
            case '&':
                d = '&amp;'; break;
            case '<':
                d = '&lt;'; break;
            case '>':
                d = '&gt;'; break;
            case ' ':
                d = '&nbsp;'; break;
        }
        s+=d;
    }
    return s;
}
function getSockets(s,sort) {
    s = s.server.sockets.sockets;
    var a = []
    for(var k in s)
        a.push(getSocket(s[k]));
    if(sort)
        a = a.sort((x,y)=>{
            if(!x.in || !y.in) return 0;
            return x.in-y.in;
        });
    return a;
}
function getSocket(s) {
    return {
        id :　s.id.substring(2),
        in : s.attrin,
        name : s.name
    }
}
Game = {};
Game.inQueue = [];
Game.player = null;
io.sockets.on('connection',function (socket) {
    socket.on('login',function (name) {
        this.name = name || "无名游客";
        this.attrin = false;
        this.emit('server msg','欢迎, '+this.name+' !');
        this.broadcast.emit('server msg','欢迎, '+this.name+' !');
        this.emit('paint paths',JSON.stringify(paths));
        var users = Game.inQueue.map(x=>{return getSocket(x)});
        this.emit('reset in users',JSON.stringify(users));

        tops.set(this.id.substring(2),this.name,0);
        var j = JSON.stringify(tops);
        this.emit('tops',j);
        this.broadcast.emit('tops',j);
        this.on('in',function () {
            if(this.attrin) return;
            this.attrin = Date.now();
            Game.inQueue.push(this);
            var json = JSON.stringify(getSocket(this));
            this.broadcast.emit('new in user',json);
            this.emit('in',json);

            setTimeout(function () {
                if(Game.player || !Game.inQueue.length) return;
                Game.run = arguments.callee
                var t=Game.inQueue[0];
                Game.player = t;
                t.time = 60;t.word = db.randomWord();
                t.emit('mytime',JSON.stringify({name:t.name,word:t.word.word,time:t.time}));
                t.broadcast.emit('othertime',JSON.stringify({name:t.name,time:t.time}));
                Game.timer = setTimeout(function () {
                    console.log(t.time,t.name);
                    if(t.time === 0){
                        delete t.time;
                        delete Game.player;
                        delete t.attrin;
                        paths=[];
                        Game.inQueue.shift();
                        setTimeout(Game.run,4000);
                        t.emit('mytimeout',t.id.substring(2));
                        t.broadcast.emit('timeout',JSON.stringify({id:t.id.substring(2),word:t.word.word}));
                        t.emit('clear paint');
                        t.broadcast.emit('clear paint');
                        return;
                    }
                    t.time--;var o = {name:t.name,time:t.time,word:t.word.word.length+'个字'};
                    if(t.time <= 30) {
                        o.word = o.word +',' + t.word.tip;
                    }
                    o = JSON.stringify(o);
                    t.emit('update my time',o);
                    t.broadcast.emit('update time',o);
                    Game.timer = setTimeout(arguments.callee,1000);
                },1000);
            },4000);
        });
        this.on('erase',function (x,y,w,h) {
            paths.push({tag:'erase',x:x,y:y,w:w,h:h});
            this.broadcast.emit('erase',x,y,w,h);
        });
        this.on('out',function () {
            console.log('before',Game.inQueue.length);
            Game.inQueue.splice(Game.inQueue.findIndex(x=>{x.id===this.id}));
            console.log('after',Game.inQueue.length);
            this.attrin = false;
            this.emit('out',this.id.substring(2));
            this.broadcast.emit('out user',this.id.substring(2));
        });
        this.on('client msg',function (msg) {
            if(!doCmd(msg,this)) {
                msg = escapeHTML(msg);
                if(Game.player && Game.player.word.word === msg){
                    if(this.prev && this.prev.player === Game.player&& this.prev.word === msg){
                        this.emit('server msg',"您已经正确回答过了！");
                        return;
                    }
                    tops.set(this.id.substring(2),this.name,tops.get(this.id.substring(2)).v+1);
                    this.emit('server msg',"真棒！回答正确！");
                    this.broadcast.emit('server msg',"恭喜！"+this.name+" 回答正确！");
                    var j = JSON.stringify(tops);
                    this.broadcast.emit('tops',j);
                    this.emit('tops',j);
                    this.prev = {
                        player:Game.player,
                        word:msg
                    };
                    return;
                }
                var date = new Date().format('yyyy-MM-dd hh:mm:ss');
                this.emit('server msg',date+'<br>'+ this.name  + ' 说: ' + msg);
                this.broadcast.emit('server msg',date+'<br>'+ this.name  + ' 说: ' + msg);
            }
        });
        this.on('disconnect',function () {
            if(Game.player && this.id === Game.player.id) {
                delete Game.player;
                paths=[];
                Game.inQueue.shift();
                if(Game.timer!=null) {
                    clearTimeout(Game.timer);
                    setTimeout(Game.run,4000);
                }
                this.broadcast.emit('othertime',JSON.stringify({name:this.name+'(已退出)',time:0}));
                this.broadcast.emit('clear paint');
            }
            if(tops.isExists(this.id.substring(2)))
                tops.remove(this.id.substring(2));
            var i =Game.inQueue.indexOf(this);
            if(i!=-1)
                Game.inQueue.splice(i,1);
            this.broadcast.emit('server msg','拜, '+this.name +'。');
            this.broadcast.emit('out user',this.id.substring(2));
            this.broadcast.emit('tops',JSON.stringify(tops));
        });
        this.on('paint',function (data) {
            if(!Game.player || Game.player.id !== this.id) return;
            data = JSON.parse(data);
            var pts = data.data;
            switch (data.status){
                case 'ing' :
                    this.broadcast.emit('paint pts',JSON.stringify(pts));
                    break;
                case 'end' :
                    this.broadcast.emit('paint pts',JSON.stringify(pts));
                    pts.tag = 'pts';
                    paths.push(pts);
                    break;
            }
        });
        this.on('repaint',function () {
            this.emit('paint paths',JSON.stringify(paths));
        })
        this.on('clear paths',function () {
            if(this === Game.player) {
                console.log('clear all');
                paths = [];
                this.emit('clear paint');
                this.broadcast.emit('clear paint');
            }
        })
    });
    socket.emit('login');
})

Date.prototype.format = function (fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}