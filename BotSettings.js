const usernames = [
    {user : "", auth : true},
    {user : "", auth : false},
    {user : "", auth : false}
]

module.exports = function(botSettings = {
    host : "",
    port : 0,

}) {

    botSettings.port ?? undefined;
    botSettings.host ?? "localhost";
    botSettings.auth = usernames[botSettings.username].auth ? "microsoft" : "mojang";
    botSettings.username = usernames[botSettings.username].user;

    return botSettings;
}