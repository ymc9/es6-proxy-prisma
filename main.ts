import { PrismaClient } from '@prisma/client';

function getSessionUser() {
    // This is just a stub for the sake of the example
    // In real application you should get the current from session
    return { id: 'user1' };
}

function getQueryGuard(model: string) {
    // policy: @@allow('read', auth() == author || published)
    return {
        OR: [
            {
                author: {
                    id: getSessionUser().id,
                },
            },
            { published: true },
        ],
    };
}

function createCrudProxy(model: string, db: any) {
    return new Proxy(db, {
        get: (target, prop, receiver) => {
            if (prop === 'findMany') {
                return (args: any) => {
                    const guard = getQueryGuard(model);
                    const augmentedArgs = {
                        ...args,
                        where: args.where
                            ? { AND: [args.where, guard] }
                            : guard,
                    };
                    // console.log(
                    //     'Augmented args:',
                    //     JSON.stringify(augmentedArgs)
                    // );
                    return Reflect.get(target, prop, receiver)(augmentedArgs);
                };
            } else {
                return Reflect.get(target, prop, receiver);
            }
        },
    });
}

async function main() {
    const prisma = new PrismaClient();

    const policyClient = new Proxy(prisma, {
        get: (target, prop, receiver) => {
            const propValue = Reflect.get(target, prop, receiver);
            if (prop === 'post') {
                return createCrudProxy(prop, propValue);
            } else {
                return propValue;
            }
        },
    });

    const posts = await prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
    });
    console.log('Posts with regular prisma:', posts);

    const posts1 = await policyClient.post.findMany({
        orderBy: { createdAt: 'desc' },
    });
    console.log('Posts with proxied prisma:', posts1);

    // const loopCount = 100000;
    // console.log('Looping for', loopCount, 'times...');

    // console.time('Regular prisma');
    // for (let i = 0; i < loopCount; i++) {
    //     await prisma.post.findMany({
    //         orderBy: { createdAt: 'desc' },
    //         where: { OR: [{ author: { id: 'user1' } }, { published: true }] },
    //     });
    // }
    // console.timeEnd('Regular prisma');

    // console.time('Proxied prisma');
    // for (let i = 0; i < loopCount; i++) {
    //     await policyClient.post.findMany({
    //         orderBy: { createdAt: 'desc' },
    //     });
    // }
    // console.timeEnd('Proxied prisma');
}

main();
