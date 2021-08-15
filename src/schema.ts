import {
  intArg,
  makeSchema,
  nonNull,
  objectType,
  stringArg,
  inputObjectType,
  arg,
  asNexusMethod,
  enumType,
  booleanArg,
} from 'nexus'
import { DateTimeResolver } from 'graphql-scalars'
import { User, Post } from 'nexus-prisma'

export const DateTime = asNexusMethod(DateTimeResolver, 'date')

const Query = objectType({
  name: 'Query',
  definition(t) {
    t.nonNull.list.nonNull.field('allUsers', {
      type: 'User',
      resolve: async (_parent, _args, context, info) => {
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'user',
          'prisma.action': 'findMany',
        })
        const users = await context.prisma.user.findMany()
        childSpan.end()
        return users
      },
    })

    t.nullable.field('postById', {
      type: 'Post',
      args: {
        id: nonNull(intArg()),
      },
      resolve: async (_parent, args, context, info) => {
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'post',
          'prisma.action': 'findUnique',
        })
        const posts = await context.prisma.post.findUnique({
          where: { id: args.id || undefined },
        })
        childSpan.end()
        return posts
      },
    })

    t.nonNull.list.nonNull.field('feed', {
      type: 'Post',
      args: {
        published: booleanArg(),
        searchString: stringArg(),
        skip: intArg(),
        take: intArg(),
        orderBy: arg({
          type: 'PostOrderByUpdatedAtInput',
        }),
      },
      resolve: async (_parent, args, context, info) => {
        const or = args.searchString
          ? {
              OR: [
                { title: { contains: args.searchString } },
                { content: { contains: args.searchString } },
              ],
            }
          : {}
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'post',
          'prisma.action': 'findMany',
        })
        const feed = context.prisma.post.findMany({
          where: {
            published: args.published ?? true,
            ...or,
          },
          take: args.take || undefined,
          skip: args.skip || undefined,
          orderBy: args.orderBy || undefined,
        })
        childSpan.end()
        return feed
      },
    })

    t.list.field('draftsByUser', {
      type: 'Post',
      args: {
        userUniqueInput: nonNull(
          arg({
            type: 'UserUniqueInput',
          }),
        ),
      },
      resolve: async (_parent, args, context, info) => {
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'post',
          'prisma.action': 'findMany',
        })
        const drafts = await context.prisma.user
          .findUnique({
            where: {
              id: args.userUniqueInput.id || undefined,
              email: args.userUniqueInput.email || undefined,
            },
          })
          .posts({
            where: {
              published: false,
            },
          })
        childSpan.end()
        return drafts
      },
    })
  },
})

const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.nonNull.field('signupUser', {
      type: 'User',
      args: {
        data: nonNull(
          arg({
            type: 'UserCreateInput',
          }),
        ),
      },
      resolve: async (_, args, context, info) => {
        const postData = args.data.posts?.map((post) => {
          return { title: post.title, content: post.content || undefined }
        })
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'user',
          'prisma.action': 'create',
        })
        try {
          const user = await context.prisma.user.create({
            data: {
              name: args.data.name,
              email: args.data.email,
              posts: {
                create: postData,
              },
            },
          })
          return user
        } catch (e) {
          childSpan.setAttribute('error', true)
          childSpan.setAttribute('prisma.error', e.toString())
          throw e
        } finally {
          childSpan.end()
        }
      },
    })

    t.field('createDraft', {
      type: 'Post',
      args: {
        data: nonNull(
          arg({
            type: 'PostCreateInput',
          }),
        ),
        authorEmail: nonNull(stringArg()),
      },
      resolve: async (_, args, context) => {
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'post',
          'prisma.action': 'create',
        })
        const draft = await context.prisma.post.create({
          data: {
            title: args.data.title,
            content: args.data.content,
            author: {
              connect: { email: args.authorEmail },
            },
          },
        })
        childSpan.end()
        return draft
      },
    })

    t.field('likePost', {
      type: 'Post',
      args: {
        id: nonNull(intArg()),
      },
      resolve: async (_, args, context) => {
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'post',
          'prisma.action': 'update',
        })
        const post = await context.prisma.post.update({
          data: {
            likes: {
              increment: 1,
            },
          },
          where: {
            id: args.id,
          },
        })
        childSpan.end()
        return post
      },
    })

    t.field('togglePublishPost', {
      type: 'Post',
      args: {
        id: nonNull(intArg()),
        published: nonNull(booleanArg()),
      },
      resolve: async (_, args, context) => {
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'post',
          'prisma.action': 'update',
        })
        const post = await context.prisma.post.update({
          where: { id: args.id },
          data: { published: args.published },
        })
        childSpan.end()
        return post
      },
    })

    t.field('deletePost', {
      type: 'Post',
      args: {
        id: nonNull(intArg()),
      },
      resolve: async (_, args, context) => {
        const { tracer } = context.request.openTelemetry()
        const childSpan = tracer.startSpan(`prisma`).setAttributes({
          'prisma.model': 'post',
          'prisma.action': 'delete',
        })
        const post = await context.prisma.post.delete({
          where: { id: args.id },
        })
        childSpan.end()
        return post
      },
    })
  },
})

const UserType = objectType({
  name: User.$name,
  definition(t) {
    t.field(User.id)
    t.field(User.name)
    t.field(User.email)
    // Relation fields can use the generated resolver from nexus-prisma or a custom one
    t.field(User.posts)
  },
})

const PostType = objectType({
  name: 'Post',
  definition(t) {
    t.field(Post.id)
    t.field(Post.createdAt)
    t.field(Post.updatedAt)
    t.field(Post.title)
    t.field(Post.content)
    t.field(Post.published)
    t.field(Post.likes)
    // Relation fields and generated resolvers from nexus-prisma
    t.field(Post.author)
  },
})

const SortOrder = enumType({
  name: 'SortOrder',
  members: ['asc', 'desc'],
})

const PostOrderByUpdatedAtInput = inputObjectType({
  name: 'PostOrderByUpdatedAtInput',
  definition(t) {
    t.nonNull.field('updatedAt', { type: 'SortOrder' })
  },
})

const UserUniqueInput = inputObjectType({
  name: 'UserUniqueInput',
  definition(t) {
    t.int('id')
    t.string('email')
  },
})

const PostCreateInput = inputObjectType({
  name: 'PostCreateInput',
  definition(t) {
    t.nonNull.string('title')
    t.string('content')
  },
})

const CommentCreateInput = inputObjectType({
  name: 'CommentCreateInput',
  definition(t) {
    t.nonNull.string('comment')
  },
})

const UserCreateInput = inputObjectType({
  name: 'UserCreateInput',
  definition(t) {
    t.nonNull.string('email')
    t.string('name')
    t.list.nonNull.field('posts', { type: 'PostCreateInput' })
  },
})

export const schema = makeSchema({
  types: [
    Query,
    Mutation,
    PostType,
    UserType,
    UserUniqueInput,
    UserCreateInput,
    PostCreateInput,
    CommentCreateInput,
    SortOrder,
    PostOrderByUpdatedAtInput,
    DateTime,
  ],
  outputs: {
    schema: __dirname + '/../schema.graphql',
    typegen: __dirname + '/generated/nexus.ts',
  },
  contextType: {
    module: require.resolve('./context'),
    export: 'Context',
  },
  sourceTypes: {
    modules: [
      {
        module: '@prisma/client',
        alias: 'prisma',
      },
    ],
  },
})
