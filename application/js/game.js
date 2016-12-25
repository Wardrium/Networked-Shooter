// Server settings
var tick_rate = 0.015;  // How often server updates game state, in seconds.

// Game Settings
var movement_speed = 20;    // How many pixels to move per game tick.

// Game information
var gm = {
    timestamp: 0,
    players: {},
    selfID: -1,
    input: {}   // map(cc.KEY, keyDown)
}

// Server communication
var sc = {
    Initialize: function(){
        socket = io.connect('http://97.69.161.115:8080');
        socket.on('connect', function(data){
            console.log('connected');
        })
        socket.on('disconnect', function(data){
            console.log('disconnected');
        });
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
    },
}

// Rendering of actual game------------------------------
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
        for (var ID in playerInfo){
            this.AddPlayer(ID, playerInfo[ID].name, playerInfo[ID].color, playerInfo[ID].position);
        }

        // Set player input
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event){
                switch(key){
                    case cc.KEY.left:
                        gm.input[cc.KEY.left] = true;
                        break;
                    case cc.KEY.right:
                        gm.input[cc.KEY.right] = true;
                        break;
                    case cc.KEY.up:
                        gm.input[cc.KEY.up] = true;
                        break;
                    case cc.KEY.down:
                        gm.input[cc.KEY.down] = true;
                        break;
                }
            }
        }, this);
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyReleased:function(key, event){
                switch(key){
                    case cc.KEY.left:
                        gm.input[cc.KEY.left] = false;
                        break;
                    case cc.KEY.right:
                        gm.input[cc.KEY.right] = false;
                        break;
                    case cc.KEY.up:
                        gm.input[cc.KEY.up] = false;
                        break;
                    case cc.KEY.down:
                        gm.input[cc.KEY.down] = false;
                        break;
                }
            }
        }, this);

        // Schedule asynchronous updates
        var that = this;    // Maintain this reference for callbacks
        this.scheduleUpdate();
        sc.OnAddPlayer(function(playerInfo){
            for (ID in playerInfo){
                that.AddPlayer(ID, playerInfo[ID].name, playerInfo[ID].color, playerInfo[ID].position);
            }
        });
        sc.OnRemovePlayer(function(ID){
            that.RemovePlayer(ID);
        });
        sc.OnUpdateMovement(function(playerInfo){
            that.UpdatePlayersMovement(playerInfo);
        });
        
        /*this.schedule(function(){
            that.UpdateSelfMovement();
        }, update_time);*/
        //sc.setOnMessage(this.updateStates);
        //this.schedule(this.sendState, 0.1);
    },
    update: function(dt){
        // Move players

    },
    AddPlayer: function(ID, name, color, position){
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

        gm.players[ID] = {'gameObject': player};   //Add reference to this player into global players dictionary
    },
    RemovePlayer: function(ID){
        gm.players[ID].gameObject.removeFromParentAndCleanup(true);
        delete gm.players[ID];
    },
    UpdateSelfMovement: function(){
        var x_pos = gm.players[selfID].gameObject.getPositionX();
        var y_pos = gm.players[selfID].gameObject.getPositionY();
        sc.UpdateMovement({'x': x_pos, 'y': y_pos}, gm.players[selfID].velocity);
    },
    UpdatePlayersMovement: function(playerInfo){
        for (var i = 0; i < playerInfo.length; ++i){
            if (playerInfo[i]['ID'] !== selfID){
                gm.players[playerInfo[i]['ID']].gameObject.setPosition(cc.p(playerInfo[i].position));
                gm.players[playerInfo[i]['ID']].velocity = playerInfo[i].velocity;
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