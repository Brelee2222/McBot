const mineflayer = require("mineflayer");
const Vec3 = require("./node_modules/vec3").Vec3;
const mineflayerViewer = require("prismarine-viewer").mineflayer;
const Entity = require("prismarine-entity").Entity;
var minecraft = require("minecraft-data")("1.18.2");

const ownerName = "";

const botToggleOptions = {
    
    sprint : function() {
        bot.controlState.sprint = !bot.controlState.sprint;
    },
    jump : function() {
        bot.controlState.jump = !bot.controlState.jump;
    },
    sneak : function() {
        bot.controlState.sneak = !bot.controlState.sneak;
    },
    forward : function() {
        bot.controlState.forward = !bot.controlState.forward;
    },
    back : function() {
        bot.controlState.back = !bot.controlState.back;
    }

}

const authorizedUsers = [
    "Brelee2222",
    ".brelee2222",
    ".Brianna_0w02039"
]

const bot = mineflayer.createBot(require("./BotSettings")( {
    host : "",
    port : 52286,
    username : 1
}));

bot.once("login", () => {
    mineflayerViewer(bot, { port : 3000 , firstPerson : true, viewDistance : 2 });
    minecraft = require("minecraft-data")(bot.version);
    console.log("[Debug]: Logged in as " + bot.username);
});

bot.on("move", () => {
    for(actionType in botMoveActions)
        if(botMoveActions[actionType])
            if(botMoveActions[actionType].run())
                break;
});

bot.on("spawn", () => console.log("[Debug]: Spawned at " + getCoordsString(bot.entity.position)));

bot.on("message", (message) => console.log("[Debug]: " + message));

bot.on("whisper", botMessage);

bot.on("chat", botMessage);

bot.on("health", () => console.log("[Debug]: Health has bee reduce to " + bot.health.toLocaleString()))

bot.on("playerCollect", (collector, collectee) => {
    if(collector != bot.entity)
        return;
    if(minecraft.items[collectee.metadata[8].itemId].enchantCategories == undefined) 
        return;
    console.log(collectee)
    if(minecraft.items[collectee.metadata[8].itemId].enchantCategories.includes("armor"))
        bot.moveSlotItem()
}); 

function doPathfinding(username, minDistance = 1.5, sprint = true) {
    if(!bot.players[username])
        return;

    let node = pathFinding.startPathfinding(bot.entity.position.floor(), bot.players[username].entity.position.floor(), minDistance);
    if(node) {
        botMoveActions.pathFind = new PathFollow(node);
        bot.controlState.forward = true;
        bot.controlState.sprint = sprint;
    }
}

function doPathfindingToCoords(position = Vec3.prototype, minDistance = 1.5, sprint = true) {
    let node = pathFinding.startPathfinding(bot.entity.position.floor(), position.floor(), minDistance);
    if(node) {
        botMoveActions.pathFind = new PathFollow(node);
        bot.controlState.forward = true;
        bot.controlState.sprint = sprint;
    }
}

function followPlayer(username, ttl = 1200, minDistance = 1.5, sprint = true) {
    if(!bot.players[username])
        return;
    
    new PlayerFollow(bot.players[username].entity, ttl, minDistance, sprint);
}

function getCoordsString(position = Vec3.prototype) {
    return "X" + position.x.toLocaleString() + " Y" + position.y.toLocaleString() + " Z" + position.z.toLocaleString();
}

function botMessage(username = "", message = "") {
    if(!authorizedUsers.includes(username))
        return;

    if(message.startsWith("say ")) {
        bot.chat(message.replace("say ", ""));
        return;
    }

    if(message.startsWith("forward ")) {
        bot.controlState.forward = true;
        arg = Number(message.replace("foward ", ""));
        bot.waitForTicks(arg ?? 20).then(() => {bot.controlState.forward = false});
        return;
    }

    if(message.startsWith("come") || message.startsWith("underoos")) {
        let minDistance = 1.5;

        args = message.split(" ").map(arg => arg.trim())

        if(args[1])
            minDistance = Number(args[1]);

        doPathfinding(username, minDistance);
        return;
    }

    if(message.includes("goto ")) {
        console.log("going to " + message.split("goto ")[1]);
        startPathfinding(message.split("goto ")[1]);
        bot.whisper(authorizedUsers[username], node ? "Coming" : "How do I get there?");
    }

    if(message.includes("inventory of "))
        console.log(bot.players[message.split("inventory of ")[1]].entity.equipment);
}

function lookAtOwner() {
    let owner = bot.players[ownerName];
    owner ? bot.lookAt(owner.entity.position.offset(0, owner.entity.height, 0)) : undefined;
}

function looAtClosestPlayer() {
    if(!bot.entities)
        return;
    let entity = bot.nearestEntity((entity) => entity.type == "player");
    bot.lookAt(entity.position.offset(0, entity.height, 0));
}

function toggleOption(option = "") {
    if(botToggleOptions[option])
        botToggleOptions[option]();
}

function findBlocks(blockName) {
    let blockposes = bot.findBlocks({
        matching : block => block.name == blockName,
        count : -1
    }).map(blockPos => bot.viewer.drawBoxGrid(blockPos.toString(), blockPos, blockPos.offset(1, 1, 1)));
    console.log(blockposes.length)
    bot.viewer.drawPoints("blocks", blockposes, 0xff0000, blockposes.length);
}

async function dropInventory() {
    slots = bot.inventory.slots
    for(slot of slots)
        if(slot != null && slot != undefined)
            await bot.tossStack(slot);
}

class MoveAction {
    run() {};
}

class PathFinding {

    movements = new class {

        pathBox = {
            startPositionX : 0,
            startPositionZ : 0,
            targetPositionX : 0,
            targetPositionZ : 0
        };

        positionMappings = {};

        reset() {
            this.positionMappings = {};  
        }
    
        move(currentNode = NodePosition.prototype, targetPosition = Vec3.prototype) {
            if(!this.positionWithinBoundary(currentNode.position)) 
                return currentNode.parentNode;
    
            if(currentNode.totalActiveChildren == -1 && !currentNode.hasDivided)
                this.produceNodeChildren(currentNode, targetPosition);
            if(currentNode.totalActiveChildren == -1) {
                currentNode.totalActiveChildren = currentNode.children.length-1;
                return currentNode.parentNode;
            } else {
                currentNode.currentPath = currentNode.children[currentNode.totalActiveChildren--]
                return currentNode.currentPath;
            }
        }

        produceNodeChildren(currentNode = NodePosition.prototype, targetPosition = Vec3.prototype) {
            currentNode.hasDivided = true;
            let prefX = targetPosition.x > currentNode.position.x ? 1 : -1;
            let prefZ = targetPosition.z > currentNode.position.z ? 1 : -1;
            this.produceChild(currentNode, currentNode.position.offset(prefX, 0, 0));
            this.produceChild(currentNode, currentNode.position.offset(0, 0, prefZ));
            this.produceChild(currentNode, currentNode.position.offset(-prefX, 0, 0));
            this.produceChild(currentNode, currentNode.position.offset(0, 0, -prefZ));
        }

        isOccupiablePosition(position) {
            return bot.blockAt(position).boundingBox == "empty" && bot.blockAt(position.offset(0, 1, 0)).boundingBox == "empty";
        }

        isOccupiedPosition(position) {
            return this.positionMappings[position];
        }

        processPosition(position) {
            let originalPos = position.clone();
            while(bot.blockAt(position.offset(0, -1, 0)).boundingBox == "empty")
                if(position.y >= -64)
                    position.translate(0, -1, 0);
                else
                    return console.log(originalPos);
            return position;
        }

        positionWithinBoundary(position = Vec3.prototype) {
            return position.x <= this.pathBox.startPositionX && position.x >= this.pathBox.targetPositionX && position.z <= this.pathBox.startPositionZ && position.z >= this.pathBox.targetPositionZ;
        }

        produceChild(currentNode = NodePosition.prototype, position = Vec3.prototype) {
            if(bot.blockAt(position.offset(0, 1, 0)).boundingBox != "empty")
                return false;
            if(bot.blockAt(position).boundingBox != "empty")
                if(bot.blockAt(currentNode.position.offset(0, 2, 0)).boundingBox == "empty" && bot.blockAt(position.offset(0, 2, 0)).boundingBox == "empty")
                    position.translate(0, 1, 0);
                else
                    return false;

            this.processPosition(position);
            let nodePos = this.isOccupiedPosition(position);
            if(nodePos) {
                if(nodePos.generation > currentNode.generation+1) {
                    currentNode.children[++currentNode.totalActiveChildren] = nodePos;
                    nodePos.parentNode = currentNode;
                    nodePos.generation = currentNode.generation+1;
                }
            } else {
                    currentNode.children[++currentNode.totalActiveChildren] = new NodePosition(currentNode, position, currentNode.generation+1);
                    this.positionMappings[position] = currentNode.children[currentNode.totalActiveChildren];
            }
        }

    };

    getBlockClearance(startPosition = new Vec3(0, 0, 0), endPosition = new Vec3(0, 0, 0)) {
        let dX = endPosition.x - startPosition.x;
        let dZ = endPosition.z - startPosition.z;
        let aX = dX / dZ;
        let aZ = dZ / dX;
        let nX = dX > 0 ? 1 : -1;
        let nZ = dZ > 0 ? 1 : -1;
        
        let position = new Vec3(0, 0, 0);

        while(position.x != dX && position.z != dZ) {
            let sX = Math.trunc(position.x) - position.x + nX;
            let sZ = Math.trunc(position.z) - position.z + nZ;

            if(Math.abs(sX * aZ) < Math.abs(sZ))
                position.translate(sX, 0, sX * aZ);
            else
                position.translate(sZ * aX, 0, sZ);

            if(!this.movements.positionMappings[position.plus(startPosition).floored()])
                return false;
        }
        return true;
    }

    skipPath = [];

    startPathfinding(startPosition = Vec3.prototype, targetPosition = Vec3.prototype, minDistance = 2, maxDistanceAway = 20 ) {
        this.skipPath.forEach(value => bot.viewer.erase(value.toString()))
        if(targetPosition.distanceTo(startPosition) < minDistance)
            return false;
        bot.waitForChunksToLoad();
        let distanceAway = 0;
        this.movements.reset();
        startPosition.floor();
        targetPosition.floor();
        this.movements.processPosition(targetPosition);
        this.movements.processPosition(startPosition);
        this.movements.pathBox = {
            startPositionX : startPosition.x > targetPosition.x ? startPosition.x : targetPosition.x,
            startPositionZ : startPosition.z > targetPosition.z ? startPosition.z : targetPosition.z,
            targetPositionX : startPosition.x < targetPosition.x ? startPosition.x : targetPosition.x,
            targetPositionZ : startPosition.z < targetPosition.z ? startPosition.z : targetPosition.z
        }

        const rootNode = new NodePosition(undefined, startPosition, 0);

        let currentNode = rootNode;

        let endNode;
        
        while(endNode == undefined) {
            while(currentNode != undefined) {
                if(targetPosition.distanceTo(currentNode.position) < minDistance)
                    endNode = currentNode;
                currentNode = this.movements.move(currentNode, targetPosition);
            }

            this.movements.pathBox.startPositionX++;
            this.movements.pathBox.startPositionZ++;
            this.movements.pathBox.targetPositionX--;
            this.movements.pathBox.targetPositionZ--;

            currentNode = rootNode;

            if(distanceAway++ > maxDistanceAway)
                return false;
        }

        while(currentNode != undefined) {
            currentNode = this.movements.move(currentNode, targetPosition);
        }

        endNode.currentPath = null;

        currentNode = endNode;

        let points = []

        while(currentNode.parentNode != null) {
            points[points.length] = currentNode.position.offset(0.5, 0.5, 0.5);
            currentNode.parentNode.currentPath = currentNode;
            currentNode = currentNode.parentNode;
        }

        let hitBoxRadius = run.minecraft.entitiesByName["player"].width/2;
        for(currentNode = rootNode; endNode != currentNode;currentNode = currentNode.currentPath) {
            for(let lastNode = endNode; currentNode != lastNode; lastNode = lastNode.parentNode) {
                if(lastNode.position.y == currentNode.position.y) {
                    if(this.getBlockClearance(currentNode.position.offset(hitBoxRadius, 0, hitBoxRadius), lastNode.position.offset(hitBoxRadius, 0, hitBoxRadius)))
                        if(this.getBlockClearance(currentNode.position.offset(-hitBoxRadius, 0, -hitBoxRadius), lastNode.position.offset(-hitBoxRadius, 0, -hitBoxRadius)))
                            if(this.getBlockClearance(currentNode.position.offset(hitBoxRadius, 0, -hitBoxRadius), lastNode.position.offset(hitBoxRadius, 0, -hitBoxRadius)))
                                if(this.getBlockClearance(currentNode.position.offset(-hitBoxRadius, 0, hitBoxRadius), lastNode.position.offset(-hitBoxRadius, 0, hitBoxRadius))) {
                                    currentNode.currentPath = lastNode;
                                    continue;  
                                }
                } else 
                    break;
            } 
        }

        this.skipPath.forEach(value => bot.viewer.drawBoxGrid(value.toString(), value, value.offset(1, 1, 1), 0x00ff00, 30));
        bot.viewer.drawPoints("pathPoints", points, 0xff00ff, 15);

        return rootNode;
    }

}

class NodePosition {
    parentNode = NodePosition.prototype;
    currentPath = NodePosition.prototype;
    children = [];

    position = Vec3.prototype;

    generation = 0;

    totalActiveChildren = -1;

    hasDivided = false;

    constructor(parent, position = Vec3.prototype, generation = 0) {
        this.parentNode = parent;
        this.position = position;
        this.generation = generation;
    }
}

class AttackEntity extends MoveAction {

    entities = [];

    constructor(entity) {
        super();
        this.entities[0] = entity;
    }
}

class PathFollow extends MoveAction {

    node = NodePosition.prototype;

    constructor(node) {
        super();
        this.node = node;
    }

    run() {

        if(this.node == undefined) {
            botMoveActions.pathFind = null;
            bot.controlState.forward = false;
            bot.controlState.sprint = false;
            bot.controlState.jump = false;
            return;
        } 

        if(this.node.position.floored().equals(bot.entity.position.floored())) {
            this.node = this.node.currentPath;
        } else {
            bot.jumpQueued = bot.entity.position.y < this.node.position.y;                
            bot.lookAt(this.node.position.clone().translate(0.5, bot.entity.height, 0.5), true);
        }
    }
}

class PlayerFollow {
    entity;
    sprint;
    minDistance = 3;
    constructor(entity, ttl = 1200, minDistance = 3, sprint = true) {
        this.sprint = sprint;
        this.entity = entity.id;
        this.minDistance = minDistance;
        bot.waitForTicks(ttl).then(() => this.follow = function(){});
        doPathfindingToCoords(entity.position, this.minDistance);
        bot.once("physicTick", this.follow);
    }

    findPathPromise = function(entity) {
        return new Promise(resolve => setTimeout(() => {
            let node = pathFinding.startPathfinding(bot.entity.position, entity.position, this.minDistance);
            if(node) {
                botMoveActions.pathFind = new PathFollow(node);
                bot.controlState.forward = true;
                bot.controlState.sprint = true;
                if(!botMoveActions.pathFind.node)
                    botMoveActions.pathFind = new PathFollow(node);
                else
                    botMoveActions.pathFind.node = node.currentPath;
            } else
                bot.lookAt(entity.position.offset(0, entity.height, 0))
            resolve("good");
        }));
    }

    follow = () => {
        let entity = bot.entities[this.entity]
        this.findPathPromise(entity);
        bot.waitForTicks(10).then(() => bot.once("physicTick", this.follow));
    }
}

const pathFinding = new PathFinding();

const botMoveActions = {
    pathFind : MoveAction.prototype,
    attack : MoveAction.prototype,
    forward : MoveAction.prototype
};

const remoteBot = new class {
    get forward() {
        toggleOption("forward");
        console.log(forward);
        return bot.controlState.forward;
    }
    get back() {
        toggleOption("back");
        console.log(back);
        return bot.controlState.back;
    }
    get left() {
        toggleOption("left");
        console.log(left);
        return bot.controlState.left;
    }
    get right() {
        toggleOption("right");
        console.log(right);
        return bot.controlState.right;
    }
    get sneak() {
        toggleOption("sneak");
        console.log(sneak);
        return bot.controlState.sneak;
    }
    get sprint() {
        toggleOption("sprint");
        console.log(sprint);
        return bot.controlState.sprint;
    }
    get jump() {
        toggleOption("jump");
        console.log(jump);
        return bot.controlState.jump;
    }
    get toggleLookAtMaster() {
    bot.listeners("physicTick").includes(lookAtOwner) ? bot.removeListener("physicTick", lookAtOwner) : function() { bot.addListener("physicTick", lookAtOwner); bot.removeListener("physicTick", looAtClosestPlayer); }();
    console.log(toggleLookAtMaster);
    return true;
    }
    get toggleLookAtNearest() {
        bot.listeners("physicTick").includes(looAtClosestPlayer) ? bot.removeListener("physicTick", looAtClosestPlayer) : function() { bot.addListener("physicTick", looAtClosestPlayer); bot.removeListener("physicTick", lookAtOwner); }();
        console.log(toggleLookAtNearest);
        return true;
    }
    
}

globalThis.run = {
    bot,
    remoteBot,
    authorizedUsers,
    minecraft,
    doPathfinding,
    doPathfindingToCoords,
    toggleOption,
    findBlocks,
    followPlayer,
    dropInventory
}
