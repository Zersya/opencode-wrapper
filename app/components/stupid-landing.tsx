"use client"

import { useEffect, useState, useRef } from "react"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { ArrowRight, Sparkles, Zap, Star, Triangle, Square, Circle, Hexagon, Pentagon, Octagon } from "lucide-react"
import { Button } from "@/components/ui/button"

// Animated floating shape component
const FloatingShape = ({ 
  children, 
  delay = 0, 
  duration = 4, 
  className = "" 
}: { 
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string 
}) => {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      animate={{
        y: [0, -30, 0],
        rotate: [0, 360],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  )
}

// Glitch text effect component
const GlitchText = ({ text, className = "" }: { text: string; className?: string }) => {
  return (
    <div className={`relative inline-block ${className}`}>
      <span className="relative z-10">{text}</span>
      <span 
        className="absolute top-0 left-0 -ml-0.5 text-[#ff006e] opacity-70 animate-pulse"
        style={{ clipPath: "inset(0 0 50% 0)", transform: "translateX(2px)" }}
      >
        {text}
      </span>
      <span 
        className="absolute top-0 left-0 -ml-0.5 text-[#00f5ff] opacity-70"
        style={{ clipPath: "inset(50% 0 0 0)", transform: "translateX(-2px)" }}
      >
        {text}
      </span>
    </div>
  )
}

// Marquee component
const Marquee = ({ children, direction = "left", speed = 20 }: { children: React.ReactNode; direction?: "left" | "right"; speed?: number }) => {
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <motion.div
        className="inline-flex"
        animate={{
          x: direction === "left" ? [0, -1000] : [-1000, 0],
        }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <span className="mx-8">{children}</span>
        <span className="mx-8">{children}</span>
        <span className="mx-8">{children}</span>
        <span className="mx-8">{children}</span>
      </motion.div>
    </div>
  )
}

// Scramble text effect
const ScrambleText = ({ text, className = "" }: { text: string; className?: string }) => {
  const [displayText, setDisplayText] = useState(text)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*"

  useEffect(() => {
    let iteration = 0
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (index < iteration) return text[index]
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join("")
      )
      iteration += 1 / 3
      if (iteration >= text.length) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [text])

  return <span className={className}>{displayText}</span>
}

// Infinite scrolling testimonials
const testimonials = [
  { name: "CEO of Nothing", role: "Professional Do-Nothing", quote: "Since using NothingAI, I've accomplished absolutely nothing 10x faster!" },
  { name: "Dr. Idle", role: "Chief Procrastination Officer", quote: "This AI helps me waste time more efficiently than ever before." },
  { name: "Lazy Larry", role: "Startup Founder", quote: "We raised $50M Series A to do nothing. Thanks NothingAI!" },
  { name: "Ms. Pause", role: "VP of Delay", quote: "Finally, an AI that matches my energy level perfectly." },
  { name: "Captain Wait", role: "Director of Postponement", quote: "I've been meaning to write this review, but NothingAI inspired me to wait." },
]

export default function StupidLandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, 360])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.5, 1])
  const springRotate = useSpring(rotateX, { stiffness: 100, damping: 30 })
  
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX - window.innerWidth / 2)
      mouseY.set(e.clientY - window.innerHeight / 2)
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [mouseX, mouseY])

  const features = [
    { icon: Sparkles, title: "Zero Output", desc: "Guaranteed to produce absolutely nothing", color: "#ff006e" },
    { icon: Zap, title: "Lightning Fast", desc: "Does nothing at the speed of light", color: "#00f5ff" },
    { icon: Star, title: "AI-Powered", desc: "Uses advanced AI to do even less", color: "#ffff00" },
  ]

  const nonsenseStats = [
    { value: "∞", label: "Things Not Done" },
    { value: "0", label: "Actual Features" },
    { value: "$0", label: "Worth of Value" },
    { value: "NaN", label: "User Satisfaction" },
  ]

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-mono"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,0,110,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,245,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
            animation: "gridMove 20s linear infinite",
          }}
        />
      </div>

      {/* Floating shapes */}
      <FloatingShape delay={0} duration={5} className="top-20 left-10">
        <Triangle className="w-16 h-16 text-[#ff006e]" fill="currentColor" />
      </FloatingShape>
      <FloatingShape delay={1} duration={6} className="top-40 right-20">
        <Circle className="w-20 h-20 text-[#00f5ff]" fill="currentColor" />
      </FloatingShape>
      <FloatingShape delay={2} duration={4} className="bottom-40 left-20">
        <Square className="w-14 h-14 text-[#ffff00]" fill="currentColor" />
      </FloatingShape>
      <FloatingShape delay={0.5} duration={7} className="top-60 left-1/3">
        <Hexagon className="w-24 h-24 text-[#ff006e]" fill="currentColor" />
      </FloatingShape>
      <FloatingShape delay={1.5} duration={5} className="bottom-20 right-10">
        <Pentagon className="w-18 h-18 text-[#00f5ff]" fill="currentColor" />
      </FloatingShape>

      {/* Marquee banners */}
      <div className="bg-[#ff006e] text-black py-2 font-bold text-lg border-y-4 border-[#ffff00]">
        <Marquee speed={15}>
          🔥 NOTHING IS THE NEW EVERYTHING 🔥 DO LESS. ACHIEVE NOTHING. 🔥 THE FUTURE IS EMPTY 🔥
        </Marquee>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.5, type: "spring" }}
          className="text-center z-10"
        >
          <motion.div
            style={{ rotateX: springRotate, scale }}
            className="mb-8"
          >
            <h1 className="text-6xl md:text-9xl font-black mb-4 tracking-tighter">
              <GlitchText text="NOTHING" className="text-[#ff006e]" />
              <span className="text-[#00f5ff]">AI</span>
            </h1>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-2xl md:text-4xl mb-8 text-[#ffff00] font-bold"
          >
            <ScrambleText text="THE AI THAT DOES ABSOLUTELY NOTHING" />
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto"
          >
            Revolutionary AI-powered platform that helps you accomplish absolutely nothing, 
            faster than ever before. Join 0 users who are doing nothing right now.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button 
              size="lg"
              className="bg-[#ff006e] hover:bg-[#ff006e]/80 text-black font-bold text-lg px-8 py-6 border-4 border-[#ffff00] hover:scale-110 transition-transform"
            >
              START DOING NOTHING
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-4 border-[#00f5ff] text-[#00f5ff] hover:bg-[#00f5ff] hover:text-black font-bold text-lg px-8 py-6 hover:scale-110 transition-transform"
            >
              LEARN LESS
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 20, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute bottom-10 text-[#ffff00] text-sm font-bold"
        >
          ↓ SCROLL FOR MORE NOTHING ↓
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 border-y-4 border-[#ff006e]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {nonsenseStats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, rotateY: -90 }}
                whileInView={{ opacity: 1, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="text-center p-6 border-4 border-dashed border-[#00f5ff] bg-[#0a0a0a]/50"
              >
                <div className="text-5xl md:text-7xl font-black text-[#ff006e] mb-2">{stat.value}</div>
                <div className="text-sm text-[#00f5ff] font-bold uppercase">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <motion.div
          style={{ 
            x: useTransform(mouseX, [-500, 500], [-50, 50]),
            y: useTransform(mouseY, [-500, 500], [-50, 50]),
          }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="text-[20rem] font-black text-white/5 select-none">NOTHING</div>
        </motion.div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.h2
            initial={{ opacity: 0, x: -100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-black mb-20 text-center"
          >
            <span className="text-[#ffff00]">FEATURES</span>
            <span className="text-gray-600 text-2xl ml-4">(we don&apos;t have any)</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 100, rotate: -10 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2, type: "spring" }}
                whileHover={{ 
                  scale: 1.05, 
                  rotate: idx % 2 === 0 ? 3 : -3,
                  transition: { type: "spring", stiffness: 300 }
                }}
                className="relative group"
              >
                <div 
                  className="p-8 border-4 transition-all duration-300 h-full"
                  style={{ borderColor: feature.color }}
                >
                  <feature.icon 
                    className="w-16 h-16 mb-6 transition-transform group-hover:rotate-180" 
                    style={{ color: feature.color }}
                  />
                  <h3 className="text-2xl font-black mb-4 uppercase" style={{ color: feature.color }}>
                    {feature.title}
                  </h3>
                  <p className="text-gray-400">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Absurd Steps */}
      <section className="py-32 px-4 bg-[#ff006e]/10">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-black mb-20 text-center text-[#00f5ff]"
          >
            HOW IT WORKS
          </motion.h2>

          {[
            { step: "01", title: "SIGN UP", desc: "Create an account (optional, we don't store anything anyway)" },
            { step: "02", title: "DO NOTHING", desc: "Our AI analyzes your desire to do nothing and does nothing about it" },
            { step: "03", title: "GET NOTHING", desc: "Receive absolutely no results, no insights, no value whatsoever" },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -100 : 100 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="flex items-center gap-8 mb-16 group"
            >
              <div 
                className="text-8xl font-black transition-transform group-hover:scale-125"
                style={{ color: idx % 2 === 0 ? "#ff006e" : "#00f5ff" }}
              >
                {item.step}
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-black mb-2 text-[#ffff00]">{item.title}</h3>
                <p className="text-xl text-gray-400">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 overflow-hidden border-y-4 border-[#00f5ff]">
        <div className="bg-[#ffff00] text-black py-4 mb-12">
          <Marquee direction="right" speed={25}>
            ⭐ TESTIMONIALS FROM REAL PEOPLE (PROBABLY) ⭐ DOING NOTHING HAS NEVER BEEN EASIER ⭐
          </Marquee>
        </div>

        <div className="flex gap-6 px-4 overflow-x-auto pb-4 scrollbar-hide">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.05, y: -10 }}
              className="min-w-[300px] p-6 border-4 border-[#ff006e] bg-[#0a0a0a]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff006e] to-[#00f5ff] flex items-center justify-center font-bold text-black">
                  {t.name[0]}
                </div>
                <div>
                  <div className="font-bold text-white">{t.name}</div>
                  <div className="text-sm text-[#00f5ff]">{t.role}</div>
                </div>
              </div>
              <p className="text-gray-400 italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-[#ffff00]" fill="currentColor" />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing - All Free */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-black mb-8"
          >
            <span className="text-[#ff006e]">PRICING</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl text-gray-400 mb-12"
          >
            Everything costs nothing. Because you get nothing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05, rotate: 2 }}
            className="inline-block p-12 border-8 border-dashed border-[#ffff00] bg-[#ff006e]/20"
          >
            <div className="text-9xl font-black text-[#ffff00] mb-4">$0</div>
            <div className="text-2xl font-bold text-white mb-8">FOREVER</div>
            <ul className="text-left space-y-4 mb-8 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-[#00f5ff]">✓</span> Zero features included
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00f5ff]">✓</span> No support whatsoever
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00f5ff]">✓</span> Absolutely no storage
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00f5ff]">✓</span> Infinite nothingness
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00f5ff]">✓</span> Void guarantee
              </li>
            </ul>
            <Button 
              size="lg"
              className="w-full bg-[#ffff00] hover:bg-[#ffff00]/80 text-black font-black text-xl py-6 border-4 border-[#ff006e]"
            >
              GET NOTHING NOW
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FAQ - Ridiculous Questions */}
      <section className="py-20 px-4 bg-[#00f5ff]/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-black mb-16 text-center text-[#ff006e]">
            QUESTIONS NO ONE ASKED
          </h2>

          {[
            { q: "What does NothingAI actually do?", a: "Nothing. That&apos;s the whole point. Are you even paying attention?" },
            { q: "Is my data safe?", a: "We don&apos;t collect any data, so technically yes. We also don&apos;t store anything, so there&apos;s nothing to steal." },
            { q: "Can I integrate this with my workflow?", a: "You can try, but it won&apos;t do anything. It integrates perfectly with procrastination though." },
            { q: "Is there an API?", a: "Yes, but every endpoint returns 404. It&apos;s very consistent." },
            { q: "Do you offer enterprise plans?", a: "We offer enterprise nothingness. Contact our sales team (we don&apos;t have one) for pricing (it&apos;s $0)." },
          ].map((faq, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="mb-8 p-6 border-l-8 border-[#ffff00] bg-[#0a0a0a]"
            >
              <h3 className="text-xl font-bold text-[#00f5ff] mb-2">Q: {faq.q}</h3>
              <p className="text-gray-400">A: {faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-[800px] h-[800px] border-8 border-dashed border-[#ff006e]/20 rounded-full" />
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-[600px] h-[600px] border-8 border-dashed border-[#00f5ff]/20 rounded-full" />
        </motion.div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-6xl md:text-8xl font-black mb-8"
          >
            <GlitchText text="READY TO DO" className="text-[#ff006e]" />
            <br />
            <GlitchText text="ABSOLUTELY" className="text-[#00f5ff]" />
            <br />
            <GlitchText text="NOTHING?" className="text-[#ffff00]" />
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Button 
              size="lg"
              className="bg-[#ff006e] hover:bg-[#ff006e]/80 text-black font-black text-2xl px-16 py-8 border-8 border-[#ffff00] hover:scale-110 transition-all animate-pulse"
            >
              GET STARTED WITH NOTHING
              <ArrowRight className="ml-4 w-8 h-8" />
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-gray-500 text-sm"
          >
            By clicking this button, you acknowledge that nothing will happen.
          </motion.p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t-4 border-[#ff006e]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-4xl font-black">
              <span className="text-[#ff006e]">NOTHING</span>
              <span className="text-[#00f5ff]">AI</span>
            </div>
            
            <div className="flex gap-8 text-sm text-gray-400">
              <span className="hover:text-[#ffff00] cursor-pointer transition-colors">About Nothing</span>
              <span className="hover:text-[#ffff00] cursor-pointer transition-colors">Features (None)</span>
              <span className="hover:text-[#ffff00] cursor-pointer transition-colors">Pricing ($0)</span>
              <span className="hover:text-[#ffff00] cursor-pointer transition-colors">Contact (Don&apos;t)</span>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-600 text-sm">
            <p>© {new Date().getFullYear()} NothingAI. All rights reserved. All wrongs reserved too.</p>
            <p className="mt-2">Made with ❤️ and absolutely no purpose whatsoever.</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
    </div>
  )
}
