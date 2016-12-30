// Server settings
var update_time = 0.045;    // How often to send updates to server, in seconds.
var tick_rate;  // How often server updates game state, in seconds.

/* Game settings. Will be read in from server.
    movement_speed: How many pixels a player can move per game tick.
    max_bullets: How many bullets can be shot at once per player.
    bullet_speed: How many pixels a bullet can move per game tick.
    shooting_cooldown: How many ticks a player has to wait before shooting again.
    player_health: Starting health of players.
    bullet_damage: Damage each bullet does to a player.
*/
var settings = {};

var game_boundary = cc.rect(0, 0, 960, 640);
var game;   // A reference to the game layer.

// Game manager
var gm = {
    timestamp: 0,
    players: {},    // map(ID, {gameObject, healthBar, health}) Note: healthBar is also a gameObject.
    bullets: {},    // map(ID, [{gameObject, velocity}])
    selfID: -1,
    aimer: {},    // gameObject of aim triangle. {gameObject}
    current_input: {},   // map(cc.KEY, keyDown)
    unprocessed_input: [],  // Array of input that has not been sent to server.
    unprocessed_bullets: [],    // Array of bullets shot that has not been sent to server.  [{position, velocity}]

    Update: function(){
        // Move player
        if (gm.players[gm.selfID].health > 0){ // Only move if player is alive.
            if (gm.current_input[cc.KEY.a]){
                gm.unprocessed_input.push(cc.KEY.a);
            }
            else if (gm.current_input[cc.KEY.d]){
                gm.unprocessed_input.push(cc.KEY.d);
            }
            if (gm.current_input[cc.KEY.w]){
                gm.unprocessed_input.push(cc.KEY.w);
            }
            else if (gm.current_input[cc.KEY.s]){
                gm.unprocessed_input.push(cc.KEY.s);
            }
        }

        // Move bullets
        for (var ID in gm.bullets){
            for (var i = 0; i < gm.bullets[ID].length; ++i){
                var bullet = gm.bullets[ID][i];
                bullet.gameObject.setPosition(cc.pAdd(bullet.gameObject.getPosition(), bullet.velocity));
                var position = bullet.gameObject.getPosition();
            }
        }
        gm.timestamp += 1;
    },
    // Move player gameObject to given end position within time seconds and num_updates number of updates.
    MovePlayer: function(player, end_pos, time, num_updates){
        var start_pos = player.getPosition();
        var current_time = 0;
        var delta_time = time / num_updates;

        this._MovePlayer(player, start_pos, end_pos, time, current_time, delta_time);
    },
    // Helper function for MovePlayer to be called recursively.
    _MovePlayer(player, start_pos, end_pos, time, current_time, delta_time){
        current_time += delta_time;
        if (current_time > time){
            current_time = time;
        }
        var x_pos = cc.lerp(start_pos.x, end_pos.x, current_time / time);
        var y_pos = cc.lerp(start_pos.y, end_pos.y, current_time / time);
        var pos = cc.p(x_pos, y_pos);
        player.setPosition(pos);
        var that = this;
        if (current_time < time){
            setTimeout(function(){
                that._MovePlayer(player, start_pos, end_pos, time, current_time, delta_time);
            }, delta_time * 1000);
        }
    },
    RotateAimer: function(mousePos){
        var diff = cc.pSub(mousePos, gm.players[gm.selfID].gameObject.getPosition());
        var angle = cc.pAngle(diff, cc.p(1, 0));    // Angle in radians
        if (diff.y > 0)
            angle = Math.PI + (Math.PI - angle);
        var pos = cc.pRotateByAngle(cc.p(70, 0), cc.p(0, 0), -angle);
        gm.aimer.gameObject.setRotation(angle * 180 / Math.PI);     // Convert to degrees
        gm.aimer.gameObject.setPosition(pos);
    },
    Shoot: function(layer){
        if (gm.players[gm.selfID].health > 0){
            var pos = cc.pAdd(gm.players[gm.selfID].gameObject.getPosition(), gm.aimer.gameObject.getPosition());
            var velocity = cc.pMult(cc.pNormalize(gm.aimer.gameObject.getPosition()), settings.bullet_speed);
            gm.unprocessed_bullets.push({'position': pos, 'velocity': velocity});
        }
    },
    AddBullet: function(layer, ID, position, velocity){
        var bullet = new cc.DrawNode();
        bullet.setPosition(position);
        if (ID == this.selfID)
            bullet.drawCircle(cc.p(0, 0), 5, 0, 10, false, 4, cc.color(0, 255, 0, 255));
        else {
            bullet.drawCircle(cc.p(0, 0), 5, 0, 10, false, 4, cc.color(255, 0, 0, 255));
        }
        layer.addChild(bullet, 1);
        gm.bullets[ID].push({'gameObject': bullet, 'velocity': velocity});
    },
    RemoveBullet: function(ID, index){
        var bullet = gm.bullets[ID][index];
        bullet.gameObject.removeFromParentAndCleanup(true);
        gm.bullets[ID].splice(index, 1);
    },
    AddPlayer: function(layer, ID, name, color, position, health){
        // Player body
        var player = new cc.DrawNode();
        player.setPosition(cc.p(position));
        if (ID == gm.selfID){
            player.drawCircle(cc.p(0, 0), 50, 0, 50, false, 4, cc.color(0, 255, 0, 255));
            gm.aimer.gameObject = new cc.DrawNode();
            player.addChild(gm.aimer.gameObject);
            gm.aimer.gameObject.setPosition(cc.p(70, 0));
            gm.aimer.gameObject.drawPoly([cc.p(-15, 15), cc.p(-15, -15), cc.p(0, 0)], 3, true, true);
        }
        else
            player.drawCircle(cc.p(0, 0), 50, 0, 50, false, 4, cc.color(255, 0, 0, 255));
        layer.addChild(player, 1);
        // Player name tag
        var nameTag = cc.LabelTTF.create(name, 'Arial', 20);
        player.addChild(nameTag, 1);
        // Player health bar
        var healthBar = new cc.DrawNode();
        player.addChild(healthBar, 1);
        gm.bullets[ID] = [];
        gm.players[ID] = {'gameObject': player, 'healthBar': healthBar, 'health': settings.player_health};   //Add reference to this player into global players dictionary
        this.UpdateHealth(ID, health);
    },
    RemovePlayer: function(ID){
        gm.players[ID].gameObject.removeFromParentAndCleanup(true);
        delete gm.players[ID];
    },
    UpdateServer: function(){
        if (gm.unprocessed_input.length > 0 || gm.unprocessed_bullets.length > 0){
            sc.UpdateServer(gm.unprocessed_input, gm.unprocessed_bullets);
            gm.unprocessed_input = [];
            gm.unprocessed_bullets = [];
        }
    },
    UpdatePlayers: function(playerInfo){
        for (var ID in playerInfo){
            // Player has moved.
            this.MovePlayer(gm.players[ID].gameObject, cc.p(playerInfo[ID].position), 0.045, 3);

            // Player has been damaged.
            if (playerInfo[ID].health != gm.players[ID].health){
                this.UpdateHealth(ID, playerInfo[ID].health);
            }
        }
    },
    UpdateHealth: function(ID, newHealth){
        if (newHealth < 0)
            newHealth = 0;
        if (this.players[ID].health != newHealth){
            var healthBar = this.players[ID].healthBar;
            var circumference = (Math.PI * 2) - newHealth / settings.player_health * (Math.PI * 2);
            healthBar.clear();
            healthBar.drawArc(cc.p(0, 0), 50, circumference, 0, 50, false, 4, cc.color(105, 105, 105));
            this.players[ID].health = newHealth;
        }
        if (ID == this.selfID && newHealth <= 0){
            // Player is dead, remove aimer.
            this.PlayerDead();
        }
    },
    // Update new bullets that were fired.
    UpdateNewBullets: function(layer, bulletInfo){
        for (var i = 0; i < bulletInfo.length; ++i){
            var bullet = bulletInfo[i];
            this.AddBullet(layer, bullet.ID, bullet.position, bullet.velocity);
        }
    },
    UpdateRemovedBullets: function(removedBulletInfo){
        for (var i = 0; i < removedBulletInfo.length; ++i){
            var bullet = removedBulletInfo[i];
            this.RemoveBullet(bullet.ID, bullet.index);
        }
    },
    LostConnection: function(layer){
        var size = cc.director.getWinSize();
        var disconnectLabel = cc.LabelTTF.create("Disconnected", 'Arial', 30);
        disconnectLabel.color = cc.color(255, 0, 0, 255);
        var labelSize = disconnectLabel.getContentSize();
        disconnectLabel.setPosition(cc.p(size.width - labelSize.width / 2, labelSize.height / 2));
        layer.addChild(disconnectLabel, 5);
    },
    PlayerDead: function(layer){
        this.aimer.gameObject.removeFromParentAndCleanup(true);
        var size = cc.director.getWinSize();
        var deadLabel = cc.LabelTTF.create("Dead. Press enter to restart.", 'Arial', 30);
        deadLabel.color = cc.color(255, 0, 0, 255);
        var labelSize = deadLabel.getContentSize();
        deadLabel.setPosition(cc.p(size.width - labelSize.width / 2, labelSize.height / 2));
        game.addChild(deadLabel, 5);

        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event){
                switch(key){
                    case cc.KEY.enter:
                        gm.RefreshPage();
                        break;
                }
            }
        }, game);
    },
    RefreshPage: function(){
        sc.Disconnect();
        cc.director.runScene(MenuLayer.scene());
    },
}

// Server communication
var sc = {
    Initialize: function(){
        socket = io.connect('http://97.69.161.115:8080');
        socket.on('connect', function(data){
            console.log('connected');
        })
    },
    OnDisconnect:function(callback){
        socket.on('disconnect', function(data){
            callback();
            console.log('disconnected');
        });
    },
    OnRefresh:function(callback){
        socket.on('refresh', function(){
            callback();
            console.log('refresh page');
        });
    },
    Disconnect:function(){
        socket.disconnect();
    },
    // Send data to server
    Register: function(name){
        socket.emit('register', name);
    },
    UpdateServer: function(unprocessed_input, unprocessed_bullets){
        socket.emit('update', {'input': unprocessed_input, 'unprocessed_bullets': unprocessed_bullets});
    },

    // Receieve data from server
    OnRegister: function(callback){
        socket.on('register', function(data){
            callback(data['timestamp'], data['settings'], data['ID'], data['players']);
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
            callback(data['timestamp'], data['playerInfo'], data['bulletInfo'], data['removedBulletInfo']);
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
                        sc.OnRegister(function(timestamp, server_settings, ID, playerInfo){
                            gm.timestamp = timestamp;
                            settings = server_settings;
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
        game = this;
        var size = cc.director.getWinSize();

        var background = new cc.DrawNode();
        background.drawRect(cc.p(0, 0), cc.p(size.width, size.height), cc.color(0, 0, 0, 255));
        this.addChild(background, 0);

        //Draw players
        for (var ID in playerInfo){
            gm.AddPlayer(this, ID, playerInfo[ID].name, playerInfo[ID].color, playerInfo[ID].position, playerInfo[ID].health);
        }

        var that = this;    // Maintain this reference for callbacks
        // Set player input
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event){
                switch(key){
                    case cc.KEY.a:
                        gm.current_input[cc.KEY.a] = true;
                        break;
                    case cc.KEY.d:
                        gm.current_input[cc.KEY.d] = true;
                        break;
                    case cc.KEY.w:
                        gm.current_input[cc.KEY.w] = true;
                        break;
                    case cc.KEY.s:
                        gm.current_input[cc.KEY.s] = true;
                        break;
                }
            }
        }, this);
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyReleased:function(key, event){
                switch(key){
                    case cc.KEY.a:
                        gm.current_input[cc.KEY.a] = false;
                        break;
                    case cc.KEY.d:
                        gm.current_input[cc.KEY.d] = false;
                        break;
                    case cc.KEY.w:
                        gm.current_input[cc.KEY.w] = false;
                        break;
                    case cc.KEY.s:
                        gm.current_input[cc.KEY.s] = false;
                        break;
                }
            }
        }, this);
        cc.eventManager.addListener({
            event: cc.EventListener.MOUSE,
            onMouseMove: function(event){
                gm.RotateAimer(event.getLocation());
            }
        }, this);
        cc.eventManager.addListener({
            event: cc.EventListener.MOUSE,
            onMouseUp: function(event){
                gm.Shoot(that);
            }
        }, this);

        // Schedule asynchronous updates
        sc.OnDisconnect(function(){
            gm.LostConnection(that);
        });
        sc.OnRefresh(function(){
            gm.RefreshPage();
        });
        sc.OnAddPlayer(function(playerInfo){
            for (ID in playerInfo){
                gm.AddPlayer(that, ID, playerInfo[ID].name, playerInfo[ID].color, playerInfo[ID].position, playerInfo[ID].health);
            }
        });
        sc.OnRemovePlayer(function(ID){
            gm.RemovePlayer(ID);
        });
        sc.OnUpdate(function(timestamp, playerInfo, bulletInfo, removedBulletInfo){
            gm.timestamp = timestamp;
            gm.UpdatePlayers(playerInfo);
            gm.UpdateNewBullets(that, bulletInfo);
            gm.UpdateRemovedBullets(removedBulletInfo);
        });

        this.schedule(function(){
            gm.Update();
        }, tick_rate);

        this.schedule(function(){
            gm.UpdateServer();
        }, update_time);
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