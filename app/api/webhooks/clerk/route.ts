import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { users, organizations, organizationMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  console.log('[Webhook] Received request to /api/webhooks/clerk')
  
  try {
    console.log('[Webhook] Verifying webhook signature...')
    const evt = await verifyWebhook(req)

    const { id } = evt.data
    if (!id) {
      throw new Error('No user ID in webhook data')
    }
    
    const eventType = evt.type

    console.log(`[Webhook] Received webhook with ID ${id} and event type: ${eventType}`)
    console.log(`[Webhook] Full event data:`, JSON.stringify(evt.data, null, 2))

    if (!id) {
      throw new Error('No user ID found in webhook data')
    }

    if (eventType === 'user.created') {
      console.log('[Webhook] Processing user.created event...')
      
      const { email_addresses, first_name, last_name, image_url, username, primary_email_address_id } = evt.data
      
      const primaryEmail = email_addresses?.find(
        (e) => e.id === primary_email_address_id
      )
      const email = primaryEmail?.email_address

      if (!email) {
        throw new Error('No primary email found')
      }

      const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'User'
      
      console.log(`[Webhook] Creating user: ${id}, email: ${email}, name: ${fullName}`)

      try {
        await db.insert(users).values({
          id,
          email,
          name: fullName,
          avatarUrl: image_url ?? undefined,
        })
        console.log(`[Webhook] Successfully created user ${id} in database`)
      } catch (userErr) {
        console.error('[Webhook] Error creating user:', userErr)
        throw userErr
      }

      const workspaceName = fullName || 'Personal'
      const baseSlug = username || id.slice(0, 8)
      const workspaceSlug = `${baseSlug}-${Date.now().toString(36)}`

      console.log(`[Webhook] Creating workspace: name="${workspaceName}", slug="${workspaceSlug}", ownerId=${id}`)

      try {
        const [organization] = await db
          .insert(organizations)
          .values({
            name: workspaceName,
            slug: workspaceSlug,
            ownerId: id,
          })
          .returning()

        console.log(`[Webhook] Successfully created organization with ID: ${organization.id}`)

        await db.insert(organizationMembers).values({
          organizationId: organization.id,
          userId: id,
          role: 'owner',
        })

        console.log(`[Webhook] Successfully added user ${id} as owner of organization ${organization.id}`)
        console.log(`[Webhook] ✅ Created personal workspace "${workspaceName}" for user ${id}`)
      } catch (orgErr) {
        console.error('[Webhook] Error creating workspace:', orgErr)
        throw orgErr
      }
    }

    if (eventType === 'user.updated') {
      console.log('[Webhook] Processing user.updated event...')
      const { email_addresses, first_name, last_name, image_url, primary_email_address_id } = evt.data
      
      const primaryEmail = email_addresses?.find(
        (e) => e.id === primary_email_address_id
      )
      const email = primaryEmail?.email_address

      const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'User'

      await db
        .update(users)
        .set({
          email: email ?? undefined,
          name: fullName,
          avatarUrl: image_url ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))

      console.log(`[Webhook] Updated user ${id} in database`)
    }

    if (eventType === 'user.deleted') {
      console.log('[Webhook] Processing user.deleted event...')
      await db.delete(users).where(eq(users.id, id))
      console.log(`[Webhook] Deleted user ${id} from database`)
    }

    return new Response('Webhook processed', { status: 200 })
  } catch (err) {
    console.error('[Webhook] ❌ Error processing webhook:', err)
    console.error('[Webhook] Error stack:', err instanceof Error ? err.stack : 'No stack trace')
    return new Response(`Error processing webhook: ${err instanceof Error ? err.message : 'Unknown error'}`, { status: 400 })
  }
}
