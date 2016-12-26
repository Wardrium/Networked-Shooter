// Server settings
var update_time = 0.045;    // How often to send updates to server, in seconds.
var tick_rate;  // How often server updates game state, in seconds.

// Game Settings
var movement_speed;    // How many pixels to move per game tick.

// Game information
var gm = {
    timestamp: 0,
    players: {},
    selfID: -1,
    current_input: {},   // map(cc.KEY, keyDown)
    unprocessed_input: [],  // Array of input that has not been sent to server.
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
    UpdateInput: function(unprocessed_input){
        socket.emit('update', {'input': unprocessed_input});
    },

    // Receieve data from server
    OnRegister: function(callback){
        socket.on('register', function(data){
            callback(data['settings'], data['ID'], data['players']);
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
    OnUpdate: function(callback){
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
                        sc.OnRegister(function(settings, ID, playerInfo){
                            timestamp = settings.timestamp;
                            tick_rate = settings.tick_rate;
                            movement_speed = settings.movement_speed;
                            gm.selfID = ID;
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
                        gm.current_input[cc.KEY.left] = true;
                        break;
                    case cc.KEY.right:
                        gm.current_input[cc.KEY.right] = true;
                        break;
                    case cc.KEY.up:
                        gm.current_input[cc.KEY.up] = true;
                        break;
                    case cc.KEY.down:
                        gm.current_input[cc.KEY.down] = true;
                        break;
                }
            }
        }, this);
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyReleased:function(key, event){
                switch(key){
                    case cc.KEY.left:
                        gm.current_input[cc.KEY.left] = false;
                        break;
                    case cc.KEY.right:
                        gm.current_input[cc.KEY.right] = false;
                        break;
                    case cc.KEY.up:
                        gm.current_input[cc.KEY.up] = false;
                        break;
                    case cc.KEY.down:
                        gm.current_input[cc.KEY.down] = false;
                        break;
                }
            }
        }, this);

        // Schedule asynchronous updates
        var that = this;    // Maintain this reference for callbacks
        sc.OnAddPlayer(function(playerInfo){
            for (ID in playerInfo){
                that.AddPlayer(ID, playerInfo[ID].name, playerInfo[ID].color, playerInfo[ID].position);
            }
        });
        sc.OnRemovePlayer(function(ID){
            that.RemovePlayer(ID);
        });
        sc.OnUpdate(function(playerInfo){
            that.UpdatePlayers(playerInfo);
        });

        this.schedule(function(){
            that.Update();
        }, tick_rate);

        this.schedule(function(){
            that.UpdateInput();
        }, update_time);
    },
    Update: function(dt){
        // Move player
        var player = gm.players[gm.selfID].gameObject;
        if (gm.current_input[cc.KEY.left]){
            player.setPosition(cc.p(player.getPositionX() - movement_speed, player.getPositionY()));
            gm.unprocessed_input.push(cc.KEY.left);
        }
        else if (gm.current_input[cc.KEY.right]){
            player.setPosition(cc.p(player.getPositionX() + movement_speed, player.getPositionY()));
            gm.unprocessed_input.push(cc.KEY.right);
        }
        if (gm.current_input[cc.KEY.up]){
            player.setPosition(cc.p(player.getPositionX(), player.getPositionY() + movement_speed));
            gm.unprocessed_input.push(cc.KEY.up);
        }
        else if (gm.current_input[cc.KEY.down]){
            player.setPosition(cc.p(player.getPositionX(), player.getPositionY() - movement_speed));
            gm.unprocessed_input.push(cc.KEY.down);
        }
    },
    AddPlayer: function(ID, name, color, position){
        // Player body
        var player = new cc.DrawNode();
        player.setPosition(cc.p(position));
        if (ID == gm.selfID){
            player.drawCircle(cc.p(0, 0), 50, 360, 50, false, 4, cc.color(0, 255, 0, 255));
        }
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
    UpdateInput: function(){
        if (gm.unprocessed_input.length > 0){
            sc.UpdateInput(gm.unprocessed_input);
            gm.unprocessed_input = [];
        }
    },
    UpdatePlayers: function(playerInfo){
        for (var ID in playerInfo){
            if (ID != gm.selfID){
                gm.players[ID].gameObject.setPosition(cc.p(playerInfo[ID].position));
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