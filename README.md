grapeDB
=======

### Uh, What?

grapeDB is a database system that is interfaced entirely through GraphQL. GraphQL is a language for querying, like SQL. Unlike SQL, however, GraphQL has typically been applied to existing data representations for web applications that already exist, unlike SQL, which has defined server implementations existing such as MySQL, Microsoft SQL Server, and PostgreSQL. Although this server runs mongo internally, it is the first attempt to make a server with GraphQL first and formost in mind.

### Okay, Why?

As explained above, there is a need for data storage solutions designed with GraphQL in mind, and some solutions already exist. One SaaS solution is [Graphcool][1], which has some feature overlap with grapeDB, but this project seeks to provide an open source solution with some feature parity.

[1]: https://graph.cool/

### Cool! How?

grapeDB in its current state runs in a [Docker Container][2]. Theoretically it could be configured to run on bare metal or across several servers even, but it is still quite early in the development process. It uses MongoDB as its backend solution, but the mongo endpoint is never exposed.

[2]: https://hub.docker.com/r/alphaweaver/grapedb/

grapeDB operates around storage of a single kind of information, the **Type.** The database stores a list of all the types that grapeDB knows about, and automatically creates ways to query and manipulate them. This holds true for types themselves, so you can add a type to the database and it reconfigures to allow working with that type over the GraphQL endpoint too.

Types are stored in the database in GraphQL shorthand syntax, the kind of syntax you see all over the GraphQL documentation when referring to how a type is defined, but the kind of syntax that can be tricky to parse. grapeDB uses the awesome `graphql-tools` library from the folks over at [Apollo][3] to handle that kind of stuff.

[3]: https://github.com/apollostack/graphql-tools

### Show me!

Issuing this query to the GraphQL endpoint:

```graphql
query {
  type(name: "Type") {
    name
    value
  }
}
```

Returns this result:

```json
{
  "data": {
    "type": {
      "name": "Type",
      "value": "type Type { name: String!, value: String! }"
    }
  }
}
```

grapeDB actually builds out a full schema of all the types, endpoints, and mutations and applies those to the data, so it looks something like this:

```graphql
type Type { name: String!, value: String! }
type User { _id: ID!, name: String! }
type Query {
  type(name: String!): Type
  user_by_id(id: ID!): User
  user(_id: ID, name: String): [User]
}
type Mutation {
  add_type( name: String!, value: String! ): Type!
  edit_type( name: String!, value: String! ): Type!
  add_user( name: String! ): User!
  edit_user(_id: ID!, name: String ): User!
  delete_user( _id: ID! ): Boolean
}
schema {
  query: Query,
  mutation: Mutation
}
```

It's important to realize that all of the above ^ was generated automatically with only the Type and User types in the database. Isn't that amazing?

## So, yeah...

There's still plenty more to come... we're very early. Some things still on the todo list are:

- More documentation, **including setup instructions**
- Interfaces
- Fragments
- Investigation into compatibility with Relay
- Performance Optimizations
- And more...

Thanks for reading, and be sure to let me know if you have any questions!
