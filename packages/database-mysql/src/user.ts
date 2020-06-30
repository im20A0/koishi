import { injectMethods, userFields, UserData, createUser, User, UserField } from 'koishi-core'
import { observe } from 'koishi-utils'

export const userGetters: Record<string, () => string> = {}
export const userPrototype: Partial<UserData> = {}

function inferFields (keys: readonly string[]) {
  return keys.map(key => key in userGetters ? userGetters[key]() : key) as UserField[]
}

function construct (data: Partial<UserData>) {
  return Object.assign(Object.create(userPrototype), data)
}

injectMethods('mysql', 'user', {
  async getUser (userId, ...args) {
    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] ? inferFields(args[0] as any) : userFields
    const [data] = await this.select<UserData[]>('user', fields, '`id` = ?', [userId])
    let fallback: UserData
    if (data) {
      data.id = userId
    } else if (authority < 0) {
      return null
    } else {
      fallback = createUser(userId, authority)
      if (authority) {
        await this.query(
          'INSERT INTO `user` (' + this.joinKeys(userFields) + ') VALUES (' + userFields.map(() => '?').join(', ') + ')',
          this.formatValues('user', fallback, userFields),
        )
      }
    }
    return construct(data || fallback)
  },

  async getUsers (...args) {
    let ids: readonly number[], fields: readonly UserField[]
    if (args.length > 1) {
      ids = args[0]
      fields = inferFields(args[1])
    } else if (args.length && typeof args[0][0] !== 'string') {
      ids = args[0]
      fields = userFields
    } else {
      fields = inferFields(args[0] as any)
    }
    if (ids && !ids.length) return []
    return (await this.select<UserData[]>('user', fields, ids && `\`id\` IN (${ids.join(', ')})`)).map(construct)
  },

  async setUser (userId, data) {
    await this.update('user', userId, data)
  },
})
