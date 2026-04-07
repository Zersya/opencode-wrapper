import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    const { id } = evt.data
    const eventType = evt.type

    console.log(`Received webhook with ID ${id} and event type of ${eventType}`)

    if (eventType === 'user.created') {
      const { email_addresses, first_name, last_name, image_url } = evt.data
      
      const email = email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id
      )?.email_address

      if (!email) {
        throw new Error('No primary email found')
      }

      const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'User'

      await db.insert(users).values({
        id,
        email,
        name: fullName,
        avatarUrl: image_url,
      })

      console.log(`Created user ${id} in database`)
    }

    if (eventType === 'user.updated') {
      const { email_addresses, first_name, last_name, image_url } = evt.data
      
      const email = email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id
      )?.email_address

      const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'User'

      await db
        .update(users)
        .set({
          email,
          name: fullName,
          avatarUrl: image_url,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))

      console.log(`Updated user ${id} in database`)
    }

    if (eventType === 'user.deleted') {
      await db.delete(users).where(eq(users.id, id))
      console.log(`Deleted user ${id} from database`)
    }

    return new Response('Webhook processed', { status: 200 })
  } catch (err) {
    console.error('Error processing webhook:', err)
    return new Response('Error processing webhook', { status: 400 })
  }
}
