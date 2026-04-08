import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import StupidLandingPage from "./components/stupid-landing"

export default async function HomePage() {
  const { userId } = await auth()
  
  if (userId) {
    redirect("/dashboard")
  }
  
  return <StupidLandingPage />
}
