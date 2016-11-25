module.exports = function() {
    var obj = {};

    obj.url = "localhost:27017/graphql";
    //obj.user = "admin";
    //obj.password = "admin";
    obj.uri = "mongodb://" + obj.url + "";

    return obj;
}();
