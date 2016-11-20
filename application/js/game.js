// Player information.
var players = {};
var selfID = null;

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
                        var data = {name: textInput.string};
                        sc.openConnection(sc.REQ_ID.register_name, data, function(response){
                            selfID = response['ID'];
                            cc.director.runScene(GameLayer.scene(response['players']));
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
    ctor:function(playerInfo){
        this._super();
        this.init(playerInfo);
    },
    init:function(playerInfo){
        this._super();

        var size = cc.director.getWinSize();

        var background = new cc.DrawNode();
        background.drawRect(cc.p(0, 0), cc.p(size.width, size.height), cc.color(0, 0, 0, 255));
        this.addChild(background, 0);

        //Draw players
        for (var ID in playerInfo){
            // Player body
            var player = new cc.DrawNode();
            player.setPosition(cc.p(playerInfo[ID]['position']));
            if (ID === selfID)
                player.drawCircle(cc.p(0, 0), 50, 360, 50, false, 4, cc.color(0, 255, 0, 255));
            else
                player.drawCircle(cc.p(0, 0), 50, 360, 50, false, 4, cc.color(255, 0, 0, 255));
            this.addChild(player, 1);
            // Player nametag
            var nameTag = cc.LabelTTF.create(playerInfo[ID]['name'], 'Arial', 20);
            player.addChild(nameTag, 1);

            players[ID] = player;   //Add reference to this player into global players dictionary
        }

        // Move player with keyboard
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event){
                var player = players[selfID];

                if (key === cc.KEY.left)
                    player.setPosition(cc.p(player.getPositionX() - 5, player.getPositionY()));
                if (key === cc.KEY.right)
                    player.setPosition(cc.p(player.getPositionX() + 5, player.getPositionY()));
                if (key === cc.KEY.up)
                    player.setPosition(cc.p(player.getPositionX(), player.getPositionY() + 5));
                if (key === cc.KEY.down)
                    player.setPosition(cc.p(player.getPositionX(), player.getPositionY() - 5));
            }
        }, this);

        sc.setOnMessage(this.updateStates);
        this.schedule(this.sendState, 0.1);
    },
    sendState: function(){
        sc.sendData(sc.REQ_ID.update_position, {ID: selfID, position: players[selfID].getPosition()});
    },
    updateStates: function(response){
        var playerInfo = response['players']
        for (var ID in playerInfo){
            players[ID].setPosition(cc.p(playerInfo[ID]['position']));
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