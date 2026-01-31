import supabase from './supabaseClient.js'

export const upsertUser = async ({ id, email, name, picture }) => {
  if (!id) throw new Error('user id is required')
  if (!email) throw new Error('user email is required')

  const { error } = await supabase
    .from('users')
    .upsert({
      id,
      email,
      name: name ?? null,
      picture: picture ?? null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    })

  if (error) {
    throw new Error(`Failed to upsert user: ${error.message}`)
  }
}
