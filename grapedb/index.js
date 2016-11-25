// import config
var config = require('./config.js')
var schemabits = require('./schemabits.js')
    // console.log(config);
console.log("Config loaded, initiating progress...")

// Import the required libraries
var graphql = require('graphql');
var graphqllang = require('graphql/language')
var graphqlutils = require('graphql/utilities')
var graphqlHTTP = require('express-graphql');
if (graphqlHTTP.default) graphqlHTTP = graphqlHTTP.default;
var express = require('express');
var mongodb = require('promised-mongo');
var gqlTools = require('graphql-tools');
// console.log(graphql_tools);

console.log("Modules loaded, connecting to DB...");

var nonIDTypes = ["Type", "Interface"];

// database setup
var db = mongodb(config.uri);

var server = null;

console.log("Connected to DB, initiating fetch of Type schemas and interfaces.")

var start = function() {

    // import schemas
    var types = {};
    var typeCollection = db.collection('Type');
    var interfaceCollection = db.collection('Interface');
    Promise.all([typeCollection.find({}).toArray(), interfaceCollection.find({}).toArray()]).then(function(results) {
        var docs = results[0];
        var interfaces = results[1];

        var typeString = schemabits;

        // add interfaces
        typeString += "\n\n";

        interfaces.map(function(d) {
            typeString += d.value + "\n\n";
            // we don't need to do anything else here yet.
        });

        // add types
        var types = [];
        var fields = [];
        docs.map(function(d) {
            typeString += d.value + "\n\n";
            types.push(d.name);
            // console.log(d);
            var ast = graphqllang.parse(d.value);
            var currentType = "";
            graphqllang.visit(ast, {
                // enter: function(node, key, parent, path, ancestors) {
                //   // console.log(node);
                // },
                // leave: function(node, key, parent, path, ancestors) {
                //
                // },
                FieldDefinition: function(node, indexOfField, b, c, d) {
                    node.directives = []; // we do this to remove the cruft
                    node.arguments = []; // ditto
                    if (indexOfField == 0 && node.name.value != '_id' && nonIDTypes.indexOf(currentType) == -1) {
                        typeCollection.remove({
                            name: currentType
                        });
                        types.splice(types.indexOf(currentType), 1); // remove type from array of types
                        // remove from typestring: XXX NOT WORKING
                        this.updateTypeString(this.intTypeString.slice(0, this.intTypeString.length - 1 - this.d.value.length - 2));
                        console.error("_id was not the first field on schema for type `" + currentType + "`, it was deleted and expunged from the schema.");
                        return;
                    }
                    fields[currentType].push(graphqllang.print(node));
                }.bind({
                    intTypeString: typeString,
                    updateTypeString: function(a) {
                        typeString = a;
                    },
                    d: d
                }),
                ObjectTypeDefinition: function(node) {
                    currentType = node.name.value;
                    fields[currentType] = [];
                    // console.log(currentType);
                }
            });
            // console.log(ast.definitions[0].fields);
            // var schema = graphqlutils.buildASTSchema(ast);
            // console.log(schema);
        });
        console.log(types);

        // add the query thing
        typeString += "type Query {\n";
        typeString += "  type(name: String!): Type\n";
        typeString += "  types: [Type]\n";
        typeString += "  interface(name: String!): Interface\n";
        typeString += "  interfaces: [Interface]\n";
        for (i in types) {
            var type = types[i];
            if (nonIDTypes.indexOf(type) != -1) continue;
            typeString += "  " + type.toLowerCase() + "_by_id(id: ID!): " + type + "\n";
            typeString += "  " + type.toLowerCase() + "(" + fields[type].join(", ").replace(/!/g, "") + "): [" + type + "]\n";
            // typeString += "  " + type.toLowerCase() + "_list: [" + type + "]\n";
        }
        typeString += "}\n\n";
        //" user(id: String!): User }";
        typeString += "type Mutation {\n";
        for (i in types) {
            var type = types[i];
            // if(type == "Type") continue;
            var arr = fields[type].slice(); // .slice clones the array
            for (i in arr) {
                if (arr[i].includes("_id")) {
                    // console.log(arr[i]);
                    arr.splice(i, 1);
                    break;
                }
            }
            typeString += "  add_" + type.toLowerCase() + "( " + arr.join(", ") + " ): " + type + "!\n";
            if (nonIDTypes.indexOf(type) == -1) {
                typeString += "  edit_" + type.toLowerCase() + "(_id: ID!, " + arr.join(", ").replace(/!/g, "") + " ): " + type + "!\n";
                typeString += "  delete_" + type.toLowerCase() + "( _id: ID! ): Boolean!\n";
            }
        }
        typeString += "  edit_type( name: String!, value: String! ): Type!\n";
        typeString += "  edit_interface( name: String!, value: String! ): Interface!\n";
        typeString += "  delete_interface( name: String!): Boolean!\n";

        typeString += "}\n\n";

        typeString += `
schema {
  query: Query,
  mutation: Mutation
}
  `;
        var resolvers = {};
        resolvers.Query = {};
        resolvers.Mutation = {};
        for (i in types) {
            if (nonIDTypes.indexOf(types[i]) != -1) continue;
            resolvers.Query[types[i].toLowerCase() + "_by_id"] = function(_, args) {
                // console.log(this);
                var c = db.collection(this);
                return c.findOne({
                    _id: mongodb.ObjectId(args.id)
                }); // get the value from the database here, based off of args id
                // console.log(prom);
            }.bind(types[i]);
            resolvers.Query[types[i].toLowerCase()] = function(_, args) {
                var c = db.collection(this);
                if (args._id) args._id = mongodb.ObjectId(args._id);
                return c.find(args).toArray().then(function(res) {
                    console.log("[READ] " + this + " | " + (Object.keys(args).length > 0 ? Object.keys(args).map(function(i) {
                        return i + ": " + args[i];
                    }).join(", ") : "(no args)") + " | returned " + res.length + " result(s).");
                    return res;
                }.bind(this));
            }.bind(types[i]);
            // resolvers.Query[types[i].toLowerCase()+"_list"] = function(_,args) {
            //   var c = db.collection(this);
            //   return c.find({}).toArray();
            // }.bind(types[i]);
            resolvers.Mutation["add_" + types[i].toLowerCase()] = function(_, args) {
                var c = db.collection(this);
                return c.save(args).then(function(doc) {
                    console.log("[ADD] " + this + " | " + doc._id);
                    return doc;
                }.bind(this));
            }.bind(types[i]);
            resolvers.Mutation["edit_" + types[i].toLowerCase()] = function(_, args) {
                var c = db.collection(this);
                args._id = mongodb.ObjectId(args._id);
                return c.findOne({
                    _id: args._id
                }).then(function(doc) {
                    console.log("[UPDATE] " + this + " | " + args._id);
                    return c.update({
                        _id: args._id
                    }, Object.assign({}, doc, args)).then(function() {
                        return Object.assign({}, this.doc, this.args);
                    }.bind({
                        doc,
                        args
                    }));
                }.bind(this));
            }.bind(types[i]);
            resolvers.Mutation["delete_" + types[i].toLowerCase()] = function(_, args) {
                var c = db.collection(this);
                args._id = mongodb.ObjectId(args._id);
                return c.remove(args, true).then(function(res) {
                    // console.log(res);
                    console.log("[DELETE] " + this + " | " + args._id);
                    return res.ok == 1 ? true : false;
                }); // true means just one
            }.bind(types[i]);
        }

        resolvers.Query.type = function(_, args) {
            var c = db.collection("Type");
            return c.findOne({
                name: args.name
            });
        };

        resolvers.Query.types = function(_, args) {
            var c = db.collection("Type");
            return c.find({});
        };

        resolvers.Query.interface = function(_, args) {
            var c = db.collection("Interface");
            return c.findOne({
                name: args.name
            });
        };

        resolvers.Query.interfaces = function(_, args) {
            var c = db.collection("Interface");
            return c.find({});
        };

        resolvers.Mutation.add_type = function(_, args) {
            var c = db.collection("Type");
            console.log("Type Change, must reboot. Rebooting in 100ms . . . ")
            setTimeout(restart, 100);
            return c.save(args);
        }

        resolvers.Mutation.edit_type = function(_, args) {
            var c = db.collection("Type");
            // console.log(args);
            // args._id = mongodb.ObjectId(args._id);
            console.log("Type Change, must reboot. Rebooting in 100ms . . . ")
            setTimeout(restart, 100);
            return c.findOne({
                name: args.name
            }).then(function(doc) {
                return c.update({
                    name: args.name
                }, Object.assign({}, doc, args)).then(function() {
                    return Object.assign({}, this.doc, this.args);
                }.bind({
                    doc,
                    args
                }));
            });
        };

        resolvers.Mutation.add_interface = function(_, args) {
            var c = db.collection("Interface");
            console.log("Interface Change, must reboot. Rebooting in 100ms . . . ")
            setTimeout(restart, 100);
            return c.save(args);
        };

        resolvers.Mutation.edit_interface = function(_, args) {
            var c = db.collection("Interface");
            // console.log(args);
            // args._id = mongodb.ObjectId(args._id);
            console.log("Interface Change, must reboot. Rebooting in 100ms . . . ")
            setTimeout(restart, 100);
            return c.findOne({
                name: args.name
            }).then(function(doc) {
                return c.update({
                    name: args.name
                }, Object.assign({}, doc, args)).then(function() {
                    return Object.assign({}, this.doc, this.args);
                }.bind({
                    doc,
                    args
                }));
            });
        };

        resolvers.Mutation.delete_interface = function(_, args) {
            var c = db.collection("Interface");
            args._id = mongodb.ObjectId(args._id);
            return c.remove(args, true).then(function(res) {
                // console.log(res);
                return res.ok == 1 ? true : false;
            }); // true means just one
        };

        // console.log(resolvers);
        console.log("=================================");
        console.log(typeString);
        console.log("=================================");
        var schema = gqlTools.makeExecutableSchema({
            typeDefs: [typeString],
            resolvers
        });

        server = express()
            .use('/graphql', graphqlHTTP({
                schema: schema,
                pretty: true,
                graphiql: true
            })).get('/', function(req, res) {
                res.redirect("/graphql");
            })
            .listen(3000);

        console.log('GraphQL server running on http://localhost:3000/graphql');
    }).catch(function(e) {
        console.log(e);
    });

}

var restart = function() {
    console.log("System is going down for reboot . . . NOW!");
    server.close();
    start();
};

start();
