var MenuLayer = cc.Layer.extend({
    ctor:function(){
        this._super();
        this.init();
    },
    init:function(){
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
                        console.log('Enter pressed. Sending request...');
                        sc.send_request(JSON.stringify({name: textInput.string}));
                        cc.director.runScene(GameLayer.scene(textInput.string));
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
    ctor:function(name){
        this._super();
        this.init(name);
    },
    init:function(name){
        this._super();
        
        var size = cc.director.getWinSize();

        var background = new cc.DrawNode();
        background.drawRect(cc.p(0, 0), cc.p(size.width, size.height), cc.color(0, 0, 0, 255));
        this.addChild(background, 0);

        var player = new cc.DrawNode();
        player.setPosition(cc.p(size.width / 2, size.height / 2));
        player.drawCircle(cc.p(0, 0), 50, 360, 50, false, 4, cc.color(255, 0, 0, 255));
        this.addChild(player, 1);

        var nameTag = cc.LabelTTF.create(name, "Arial", 20);
        player.addChild(nameTag, 1);

        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event){
                switch(key){
                    case cc.KEY.left:
                        player.setPosition(cc.p(player.getPositionX() - 5, player.getPositionY()));
                        break;
                    case cc.KEY.right:
                        player.setPosition(cc.p(player.getPositionX() + 5, player.getPositionY()));
                        break;
                    case cc.KEY.up:
                        player.setPosition(cc.p(player.getPositionX(), player.getPositionY() + 5));
                        break;
                    case cc.KEY.down:
                        player.setPosition(cc.p(player.getPositionX(), player.getPositionY() - 5));
                        break;

                }
            }
        }, this);

        /*var sprite = cc.Sprite.create("HelloWorld.png");
        sprite.setPosition(size.width / 2, size.height / 2);
        sprite.setScale(1.0);
        this.addChild(sprite, 0);*/


    },
    onEnter:function(){
        this._super();
    }
});

GameLayer.scene = function(name){
    var scene = new cc.Scene();
    var layer = new GameLayer(name);
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

        //load resources
        cc.LoaderScene.preload(["HelloWorld.png"], function () {
            cc.director.runScene(MenuLayer.scene());
        }, this);
    };
    cc.game.run("gameCanvas");
};