import { readFileSync } from 'fs';
import { ApolloServer } from '@apollo/server';
import { join } from 'path';
import { Neo4jGraphQL } from '@neo4j/graphql';
import { it, describe, expect, test } from 'vitest';
import { gql } from '@apollo/client/core';
import neo4j from 'neo4j-driver';
const driver = neo4j.driver(
    process.env.NEO4J_DATABASE_HOST,
    neo4j.auth.basic(
        process.env.NEO4J_DATABASE_USERNAME,
        process.env.NEO4J_DATABASE_PASSWORD
    )
);

describe('testing graphql', async () => {
    await driver.session().run(` match (n) detach delete n`);
    const myUserId = Math.random().toString(36).slice(2, 7);
    const neo4jGraphql = new Neo4jGraphQL({
        typeDefs: readFileSync(
            join(__dirname, 'schema.graphql'),
            'utf8'
        ).toString(),
        driver,
        features: {
            populatedBy: {
                callbacks: {
                    getUserIDFromContext: () => 'hi',
                },
            },
        },
    });
    const apolloServer = new ApolloServer({
        schema: await neo4jGraphql.getSchema(),
        introspection: true,
    });
    it('create tenant', async () => {
        const r = await apolloServer.executeOperation(
            {
                query: gql`
                    mutation addTenant($input: [TenantCreateInput!]!) {
                        createTenants(input: $input) {
                            tenants {
                                id
                                admins {
                                    userId
                                }
                                settings {
                                    openingDays {
                                        open {
                                            name
                                        }
                                    }
                                    myWorkspace {
                                        workspace
                                    }
                                }
                            }
                        }
                    }
                `,
                variables: {
                    input: {
                        settings: {
                            create: {
                                node: {
                                    openingDays: {
                                        create: [
                                            {
                                                node: {
                                                    open: {
                                                        create: [
                                                            {
                                                                node: {
                                                                    name: 'hi',
                                                                },
                                                            },
                                                        ],
                                                    },
                                                },
                                            },
                                            {
                                                node: {
                                                    open: {
                                                        create: [
                                                            {
                                                                node: {
                                                                    name: 'hi',
                                                                },
                                                            },
                                                            {
                                                                node: {
                                                                    name: 'hi',
                                                                },
                                                            },
                                                        ],
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            { contextValue: { jwt: { id: myUserId } } }
        );
        expect(r).toMatchObject({
            body: {
                singleResult: {
                    data: {
                        createTenants: {
                            tenants: [
                                {
                                    id: expect.any(String),
                                    admins: [{ userId: myUserId }],
                                },
                            ],
                        },
                    },
                },
            },
        });
    });
});
