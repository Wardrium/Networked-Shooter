// Game settings
var update_time = 0.1;  // How often to send updates to game server on movement data, in seconds.
var move_speed = 50.0;

// Player information
var players = {};
var selfID = null;

// Server communication
var sc = {
    Initialize: function(){
        socket = io.connect('http://98.243.38.5:8080');
    },
    // Send data to server
    Register: function(name){
        socket.emit('register', name);
    },
    UpdateMovement: function(position, velocity){
        socket.emit('update', {'position': position, 'velocity': velocity});
    },

    // Receieve data from server
    OnRegister: function(callback){
        socket.on('register', function(data){
            callback(data['ID'], data['players']);
        });
    },
    OnAddPlayer: function(callback){
        socket.on('add player', function(data){
            callback(data);
        });
    },
    OnRemovePlayer: function(callback){
        socket.on('remove player', function(data){
            callback(data);
        });
    },
    OnUpdateMovement: function(callback){
        socket.on('update', function(data){
            callback(data);
        });
    }
}


var MenuLayer = cc.Layer.extend({
    ctor: function(){
        this._super();
        this.init();
    },
    init: function(){
        this._super();
        var size = cc.director.getWinSize();

        var background = new cc.DrawNode();
        background.drawRect(cc.p(0, 0), cc.p(size.width, size.height), cc.color(0, 0, 0, 255));
        this.addChild(background, 0);

        var textInput = ccui.TextField.create("Enter Your Name", "Arial", 40);
        textInput.setTextHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        textInput.setTextVerticalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        textInput.setPosition(size.width / 2, size.height / 2);
        this.addChild(textInput, 1);

        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event){
                switch(key){
                    case cc.KEY.enter:
                        sc.Initialize();
                        sc.Register(textInput.string);
                        sc.OnRegister(function(ID, playerInfo){
                            selfID = ID;
                            cc.director.runScene(GameLayer.scene(playerInfo));
                        });
                        break;
                }
            }
        }, this);
    },
})

MenuLayer.scene = function(){
    var scene = new cc.Scene();
    var layer = new MenuLayer();
    scene.addChild(layer, 1);

    return scene;
}


var GameLayer = cc.Layer.extend({
    ctor: function(playerInfo){
        this._super();
        this.init(playerInfo);
    },
    init: function(playerInfo){
        this._super();
        var size = cc.director.getWinSize();

        var background = new cc.DrawNode();
        background.drawRect(cc.p(0, 0), cc.p(size.width, size.height), cc.color(0, 0, 0, 255));
        this.addChild(background, 0);

        //Draw players
        for (var i = 0; i < playerInfo.length; ++i){
            this.AddPlayer(playerInfo[i]['ID'], playerInfo[i]['name'], playerInfo[i]['position'], playerInfo[i]['velocity']);
        }

        // Set player velocity
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event){
                if (key === cc.KEY.left)
                    players[selfID]['velocity']['x'] = -move_speed;
                else if (key === cc.KEY.right)
                    players[selfID]['velocity']['x'] = move_speed;
                if (key === cc.KEY.up)
                    players[selfID]['velocity']['y'] = move_speed;
                else if (key === cc.KEY.down)
                    players[selfID]['velocity']['y'] = -move_speed;
            }
        }, this);
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyReleased:function(key, event){
                if (key === cc.KEY.left)
                    players[selfID]['velocity']['x'] = 0;
                else if (key === cc.KEY.right)
                    players[selfID]['velocity']['x'] = 0;
                if (key === cc.KEY.up)
                    players[selfID]['velocity']['y'] = 0;
                else if (key === cc.KEY.down)
                    players[selfID]['velocity']['y'] = 0;
            }
        }, this);

        // Schedule asynchronous updates
        var that = this;    // Maintain this reference for callbacks
        this.scheduleUpdate();
        sc.OnAddPlayer(function(playerInfo){
            that.AddPlayer(playerInfo['ID'], playerInfo['name'], playerInfo['position'], playerInfo['velocity']);
        });
        sc.OnRemovePlayer(function(ID){
            that.RemovePlayer(ID);
        });
        sc.OnUpdateMovement(function(playerInfo){
            that.UpdatePlayersMovement(playerInfo);
        });
        
        this.schedule(function(){
            that.UpdateSelfMovement();
        }, update_time);
        //sc.setOnMessage(this.updateStates);
        //this.schedule(this.sendState, 0.1);
    },
    update: function(dt){
        // Move the player
        var x_pos = players[selfID]['gameObject'].getPositionX() + players[selfID]['velocity']['x'] * dt;
        var y_pos = players[selfID]['gameObject'].getPositionY() + players[selfID]['velocity']['y'] * dt;
        players[selfID]['gameObject'].setPosition(cc.p(x_pos, y_pos));
    },
    AddPlayer: function(ID, name, position, velocity){
        // Player body
        var player = new cc.DrawNode();
        player.setPosition(cc.p(position));
        if (ID === selfID)
            player.drawCircle(cc.p(0, 0), 50, 360, 50, false, 4, cc.color(0, 255, 0, 255));
        else
            player.drawCircle(cc.p(0, 0), 50, 360, 50, false, 4, cc.color(255, 0, 0, 255));
        this.addChild(player, 1);
        // Player nametag
        var nameTag = cc.LabelTTF.create(name, 'Arial', 20);
        player.addChild(nameTag, 1);

        players[ID] = {'gameObject': player, 'velocity': velocity};   //Add reference to this player into global players dictionary
    },
    RemovePlayer: function(ID){
        players[ID]['gameObject'].removeFromParentAndCleanup(true);
        delete players[ID];
    },
    UpdateSelfMovement: function(){
        var x_pos = players[selfID]['gameObject'].getPositionX();
        var y_pos = players[selfID]['gameObject'].getPositionY();
        sc.UpdateMovement({'x': x_pos, 'y': y_pos}, players[selfID]['velocity']);
    },
    UpdatePlayersMovement: function(playerInfo){
        for (var i = 0; i < playerInfo.length; ++i){
            if (playerInfo[i]['ID'] !== selfID){
                players[i]['gameObject'].setPosition(cc.p(playerInfo[i]['position']));
            }           
        }
    },
});

GameLayer.scene = function(playerInfo){
    var scene = new cc.Scene();
    var layer = new GameLayer(playerInfo);
    scene.addChild(layer);
    return scene;
}

window.onload = function(){

    var targetWidth = 960;
    var targetHeight = 640;

    cc.game.onStart = function(){
        cc.view.adjustViewPort(false);
        cc.view.setDesignResolutionSize(targetWidth, targetHeight, cc.ResolutionPolicy.SHOW_ALL);
        cc.view.resizeWithBrowserSize(true);

        cc.director.runScene(MenuLayer.scene());
    };
    cc.game.run("gameCanvas");
};