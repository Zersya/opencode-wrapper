"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// Custom cursor component
function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.closest(".interactive")
      ) {
        setIsHovered(true);
      }
    };

    const handleMouseOut = () => {
      setIsHovered(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, []);

  return (
    <>
      <motion.div
        ref={cursorRef}
        className="fixed w-5 h-5 border-2 border-[#00f5ff] rounded-full pointer-events-none z-[9999] mix-blend-difference"
        animate={{
          x: position.x - 10,
          y: position.y - 10,
          scale: isHovered ? 2.5 : 1,
          backgroundColor: isHovered ? "#ff006e" : "transparent",
          borderColor: isHovered ? "#ff006e" : "#00f5ff",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      />
      <motion.div
        ref={dotRef}
        className="fixed w-1.5 h-1.5 bg-[#ccff00] rounded-full pointer-events-none z-[9999] mix-blend-difference"
        animate={{
          x: position.x - 3,
          y: position.y - 3,
        }}
        transition={{ type: "spring", stiffness: 1000, damping: 28 }}
      />
    </>
  );
}

// Floating background shapes
function FloatingShapes() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      <motion.div
        className="absolute w-[300px] h-[300px] -left-[5%] top-[10%] rounded-full opacity-40 mix-blend-screen"
        style={{
          background: "radial-gradient(circle, #ff006e 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[200px] h-[200px] -right-[5%] top-[60%] rounded-full opacity-40 mix-blend-screen"
        style={{
          background: "radial-gradient(circle, #00f5ff 0%, transparent 70%)",
        }}
        animate={{
          x: [0, -20, 30, 0],
          y: [0, 20, -30, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[150px] h-[150px] left-[20%] bottom-[20%] rounded-full opacity-40 mix-blend-screen"
        style={{
          background: "radial-gradient(circle, #ccff00 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 25, -15, 0],
          y: [0, -25, 15, 0],
          scale: [1, 1.05, 0.95, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// Animated background grid
function BackgroundGrid() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none animate-grid-move"
      style={{
        width: "200%",
        height: "200%",
        backgroundImage: `
          linear-gradient(90deg, rgba(255,0,110,0.03) 1px, transparent 1px),
          linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "50px 50px",
      }}
    />
  );
}

// Marquee component
function Marquee() {
  const items = [
    "100% Unnecessary",
    "Zero Practical Value",
    "Maximum Chaos",
    "Minimal Effort",
    "Existential Dread",
    "Questionable Quality",
  ];

  return (
    <div className="bg-[#ff006e] text-[#0a0a0a] py-4 overflow-hidden relative -rotate-2 scale-105 my-16">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: [0, -50 * items.length * 6] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items, ...items, ...items].map((item, index) => (
          <span
            key={index}
            className="font-bebas text-2xl px-12 flex items-center gap-4"
          >
            {item}
            <span className="text-[#ccff00] text-xl">★</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// Animated counter component
function AnimatedCounter({ target, suffix = "" }: { target: number | string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    if (target === "∞") return;

    const targetNum = typeof target === "string" ? parseInt(target) : target;
    const duration = 2000;
    const steps = 60;
    const increment = targetNum / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetNum) {
        setCount(targetNum);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <div ref={ref} className="font-bebas text-6xl md:text-8xl text-[#ccff00] drop-shadow-[0_0_30px_rgba(204,255,0,0.5)]">
      {target === "∞" ? "∞" : count}
      {suffix}
    </div>
  );
}

// Feature card component
function FeatureCard({ icon, title, description, index }: { icon: string; title: string; description: string; index: number }) {
  return (
    <motion.div
      className="interactive bg-white/[0.03] border border-white/10 p-8 relative overflow-hidden group hover:-translate-y-2.5 hover:border-[#00f5ff] transition-all duration-300"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#ff006e] via-[#00f5ff] to-[#ccff00] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
      <span className="text-5xl mb-4 block">{icon}</span>
      <h3 className="font-syne font-bold text-xl mb-2 text-[#00f5ff]">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed font-mono">{description}</p>
    </motion.div>
  );
}

// Testimonial card component
function TestimonialCard({ quote, name, role, initials, index }: { quote: string; name: string; role: string; initials: string; index: number }) {
  const rotation = index % 2 === 0 ? -1 : 1;
  const gradient = index % 2 === 0 
    ? "from-[rgba(255,0,110,0.1)] to-[rgba(0,245,255,0.1)]"
    : "from-[rgba(204,255,0,0.1)] to-[rgba(255,107,53,0.1)]";

  return (
    <motion.div
      className={`bg-gradient-to-br ${gradient} border border-white/10 p-12 mb-8 relative`}
      style={{ transform: `rotate(${rotation}deg)` }}
      initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15 }}
    >
      <p className="font-syne font-bold text-xl md:text-2xl leading-relaxed mb-6 text-[#fafafa]">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff006e] to-[#00f5ff] flex items-center justify-center font-bebas text-xl text-[#0a0a0a]">
          {initials}
        </div>
        <div className="font-mono">
          <div className="font-bold text-[#00f5ff]">{name}</div>
          <div className="text-xs text-white/50">{role}</div>
        </div>
      </div>
    </motion.div>
  );
}

// Glitch text effect
function GlitchText({ text }: { text: string }) {
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => setIsGlitching(false), 500);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative inline-block">
      <span className="relative z-10">{text}</span>
      {isGlitching && (
        <>
          <motion.span
            className="absolute top-0 left-0 text-[#ff006e] z-0"
            animate={{
              x: [-2, 2, -2, 2, 0],
              clipPath: [
                "inset(20% 0 80% 0)",
                "inset(60% 0 10% 0)",
                "inset(40% 0 50% 0)",
                "inset(80% 0 5% 0)",
                "inset(10% 0 70% 0)",
              ],
            }}
            transition={{ duration: 0.3 }}
          >
            {text}
          </motion.span>
          <motion.span
            className="absolute top-0 left-0 text-[#00f5ff] z-0"
            animate={{
              x: [2, -2, 2, -2, 0],
              clipPath: [
                "inset(10% 0 60% 0)",
                "inset(30% 0 20% 0)",
                "inset(70% 0 10% 0)",
                "inset(20% 0 50% 0)",
                "inset(50% 0 30% 0)",
              ],
            }}
            transition={{ duration: 0.3 }}
          >
            {text}
          </motion.span>
        </>
      )}
    </span>
  );
}

// Main page component
export default function StupidLandingPage() {
  const [ctaText, setCtaText] = useState("DO THE THING");

  const features = [
    {
      icon: "🎲",
      title: "Random Decisions",
      description: "We use advanced coin-flipping technology and dart-throwing at roadmaps to determine our product strategy. It's like agile, but with more chaos.",
    },
    {
      icon: "🔥",
      title: "Spontaneous Combustion",
      description: "Our servers have a 73% chance of staying online at any given moment. We call this 'surprise downtime' - it keeps users on their toes.",
    },
    {
      icon: "🌪️",
      title: "Product Pivoting",
      description: "Tuesday we're a fintech. Wednesday we're a social network. Thursday? Maybe a bakery. Who knows! That's the fun part.",
    },
    {
      icon: "🎭",
      title: "Corporate Gaslighting",
      description: "'That's not a bug, it's a feature' isn't just a phrase here - it's our entire business model. You'll learn to love the bugs.",
    },
    {
      icon: "🦄",
      title: "Buzzword Generation",
      description: "AI-powered blockchain synergy with quantum neural networks. We don't know what it means either, but it sounds expensive!",
    },
    {
      icon: "🍕",
      title: "Pizza Acquisition",
      description: "Our primary KPI is pizza consumption per capita. Currently at 3.7 slices per employee per day. We're very proud.",
    },
  ];

  const testimonials = [
    {
      quote: "I'm not entirely sure what they do, but they do it with such confidence that I just gave them my credit card. I regret everything.",
      name: "John Doe",
      role: "Professional Regretter",
      initials: "JD",
    },
    {
      quote: "My lawyer advised me not to comment on this. Draw your own conclusions.",
      name: "Alex Johnson",
      role: "Former Customer, Current Witness",
      initials: "AJ",
    },
    {
      quote: "I clicked the button and now I own three alpacas and a timeshare in Delaware. 5 stars.",
      name: "Sarah Miller",
      role: "Accidental Alpaca Enthusiast",
      initials: "SM",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa] overflow-x-hidden cursor-none">
      <CustomCursor />
      <BackgroundGrid />
      <FloatingShapes />

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col justify-center items-center px-8 relative">
          <motion.div
            className="font-syne font-bold text-xs tracking-[0.3em] uppercase text-[#ccff00] border-2 border-[#ccff00] px-4 py-2 -rotate-3 mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              boxShadow: "0 0 0 0 rgba(204, 255, 0, 0.4)",
              animation: "badgePulse 2s ease-in-out infinite",
            }}
          >
            ⚠️ Warning: Very Stupid
          </motion.div>

          <h1 className="font-bebas text-[clamp(4rem,15vw,12rem)] leading-[0.9] text-center uppercase tracking-tight mb-4">
            <motion.span
              className="inline-block text-[#ff006e] drop-shadow-[4px_4px_0_#7209b7]"
              initial={{ opacity: 0, y: 100, rotateX: -90 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              We
            </motion.span>{" "}
            <motion.span
              className="inline-block text-[#00f5ff] drop-shadow-[4px_4px_0_#ff6b35]"
              initial={{ opacity: 0, y: 100, rotateX: -90 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              Make
            </motion.span>{" "}
            <motion.span
              className="inline-block text-[#ccff00] drop-shadow-[4px_4px_0_#ff006e]"
              initial={{ opacity: 0, y: 100, rotateX: -90 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Stuff™
            </motion.span>
          </h1>

          <motion.p
            className="font-mono text-center max-w-xl my-8 text-white/70 text-sm md:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            Is it good? Sometimes. Is it necessary? Absolutely not. But hey, we exist and we&apos;re doing things. 
            Mostly breaking things. But also making things. It&apos;s complicated.
          </motion.p>

          <motion.div
            className="flex gap-4 flex-wrap justify-center mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <a
              href="#features"
              className="interactive font-syne font-bold text-sm tracking-wider uppercase px-8 py-4 bg-[#ff006e] text-[#0a0a0a] relative overflow-hidden transition-transform hover:scale-105"
              style={{ clipPath: "polygon(0 0, 100% 0, 95% 100%, 5% 100%)" }}
            >
              <span className="relative z-10">Do Something</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-500" />
            </a>
            <a
              href="#cta"
              className="interactive font-syne font-bold text-sm tracking-wider uppercase px-8 py-4 border-2 border-[#00f5ff] text-[#00f5ff] relative overflow-hidden transition-transform hover:scale-105"
              style={{ clipPath: "polygon(5% 0, 100% 0, 95% 100%, 0 100%)" }}
            >
              Regret Later
            </a>
          </motion.div>
        </section>

        {/* Marquee */}
        <Marquee />

        {/* Features Section */}
        <section id="features" className="py-24 px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#ff6b35] mb-4">
              // Our &ldquo;Services&rdquo;
            </div>
            <h2 className="font-bebas text-[clamp(2.5rem,8vw,5rem)] uppercase text-[#fafafa]">
              <GlitchText text="THINGS WE DO" />
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} index={index} />
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="flex justify-center gap-8 md:gap-16 flex-wrap py-16 px-8 bg-gradient-to-b from-transparent via-[rgba(114,9,183,0.1)] to-transparent">
          <div className="text-center">
            <AnimatedCounter target={0} />
            <div className="font-mono text-xs tracking-wider uppercase text-white/50 mt-2">Happy Customers</div>
          </div>
          <div className="text-center">
            <AnimatedCounter target={847} />
            <div className="font-mono text-xs tracking-wider uppercase text-white/50 mt-2">Bugs Shipped</div>
          </div>
          <div className="text-center">
            <AnimatedCounter target="∞" />
            <div className="font-mono text-xs tracking-wider uppercase text-white/50 mt-2">Regrets</div>
          </div>
          <div className="text-center">
            <AnimatedCounter target={3} />
            <div className="font-mono text-xs tracking-wider uppercase text-white/50 mt-2">Coffee Breaks / Hour</div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 px-8 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#ff6b35] mb-4">
              // Unsolicited &ldquo;Praise&rdquo;
            </div>
            <h2 className="font-bebas text-[clamp(2.5rem,8vw,5rem)] uppercase text-[#fafafa]">
              WHAT PEOPLE SAY
            </h2>
          </div>

          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} {...testimonial} index={index} />
          ))}
        </section>

        {/* CTA Section */}
        <section id="cta" className="py-32 px-8 text-center relative overflow-hidden">
          <h2 className="font-bebas text-[clamp(2rem,8vw,5rem)] uppercase mb-8 relative z-10">
            READY TO{" "}
            <span className="relative inline-block text-[#ff006e]">
              <span className="relative z-10">MAKE BAD DECISIONS</span>
              <span className="absolute bottom-0 -left-[5%] w-[110%] h-[30%] bg-[#ccff00] -z-0 -rotate-2" />
            </span>{" "}
            TOGETHER?
          </h2>

          <motion.button
            className="interactive font-syne font-extrabold text-xl tracking-wider uppercase px-16 py-6 bg-gradient-to-r from-[#ff006e] to-[#ff6b35] text-[#0a0a0a] relative z-10 transition-transform hover:scale-110 hover:-rotate-2"
            style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)" }}
            onClick={() => setCtaText(ctaText === "DO THE THING" ? "TOO LATE NOW" : "DO THE THING")}
            whileHover={{ scale: 1.1, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            {ctaText}
          </motion.button>
        </section>

        {/* Footer */}
        <footer className="py-16 px-8 border-t border-white/10 text-center">
          <div className="font-bebas text-3xl text-[#ff006e] mb-4">STUPID THINGS INC.</div>
          <p className="font-mono text-xs text-white/40">
            © 2024 Stupid Things Inc. All rights reserved. | No refunds. No take-backs. No do-overs.
          </p>
          <div className="flex justify-center gap-8 mt-8">
            <a href="#" className="interactive font-mono text-xs text-[#00f5ff] hover:text-[#ccff00] transition-colors">
              Don&apos;t Click
            </a>
            <a href="#" className="interactive font-mono text-xs text-[#00f5ff] hover:text-[#ccff00] transition-colors">
              Seriously Don&apos;t
            </a>
            <a href="#" className="interactive font-mono text-xs text-[#00f5ff] hover:text-[#ccff00] transition-colors">
              Privacy? LOL
            </a>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;700;800&display=swap');

        .font-bebas {
          font-family: 'Bebas Neue', sans-serif;
        }

        .font-mono {
          font-family: 'Space Mono', monospace;
        }

        .font-syne {
          font-family: 'Syne', sans-serif;
        }

        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-50px, -50px); }
        }

        .animate-grid-move {
          animation: gridMove 20s linear infinite;
        }

        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(204, 255, 0, 0.4); }
          50% { box-shadow: 0 0 20px 5px rgba(204, 255, 0, 0.2); }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-grid-move {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
