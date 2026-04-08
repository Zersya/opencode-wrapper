'use client';

import { SignIn } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const floatingAnimation = {
  y: [-8, 8, -8],
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const features = [
  { icon: Zap, text: 'Lightning fast execution' },
  { icon: Shield, text: 'Enterprise-grade security' },
  { icon: Sparkles, text: 'AI-powered workflows' },
];

export default function SignInPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0c10]">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -left-40 top-20 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-blue-600/15 via-indigo-500/10 to-transparent blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 60, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute left-1/3 top-1/2 h-[400px] w-[400px] rounded-full bg-gradient-to-r from-violet-600/10 to-fuchsia-600/5 blur-3xl"
        />
      </div>

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen">
        {/* Left side - Branding */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between p-12 xl:p-16"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-white"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">
              OpenCode
            </span>
          </motion.div>

          {/* Hero content */}
          <div className="max-w-xl">
            <motion.h1
              variants={itemVariants}
              className="text-4xl xl:text-5xl font-semibold leading-tight tracking-tight text-white"
            >
              Execute code with
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                superhuman speed
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-6 text-lg text-gray-400 leading-relaxed"
            >
              A Linear-like project management platform with opencode CLI execution.
              Ship faster, collaborate better.
            </motion.p>

            {/* Feature pills */}
            <motion.div
              variants={itemVariants}
              className="mt-10 flex flex-wrap gap-3"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1, duration: 0.4 }}
                  className="group flex items-center gap-2 rounded-full border border-gray-800/60 bg-gray-900/40 px-4 py-2 backdrop-blur-sm transition-all hover:border-indigo-500/30 hover:bg-gray-800/60"
                >
                  <feature.icon className="h-4 w-4 text-indigo-400 transition-colors group-hover:text-indigo-300" />
                  <span className="text-sm font-medium text-gray-300">
                    {feature.text}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Stats or testimonial */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-8"
          >
            <div>
              <div className="text-2xl font-semibold text-white">10x</div>
              <div className="text-sm text-gray-500">Faster execution</div>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div>
              <div className="text-2xl font-semibold text-white">99.9%</div>
              <div className="text-sm text-gray-500">Uptime guaranteed</div>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div>
              <div className="text-2xl font-semibold text-white">50k+</div>
              <div className="text-sm text-gray-500">Developers</div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right side - Login form */}
        <div className="flex w-full lg:w-1/2 xl:w-[45%] items-center justify-center p-6 lg:p-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md"
          >
            {/* Mobile logo */}
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span className="text-xl font-semibold text-white">OpenCode</span>
            </div>

            {/* Sign in card */}
            <div className="relative">
              {/* Card glow effect */}
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-indigo-500/20 opacity-0 blur transition-opacity duration-500 hover:opacity-100" />
              
              <div className="relative overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-900/80 backdrop-blur-xl">
                {/* Subtle gradient overlay on card */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />
                
                <div className="relative p-1">
                  <SignIn
                    appearance={{
                      elements: {
                        rootBox: 'w-full',
                        card: 'bg-transparent shadow-none border-0 p-4',
                        header: 'hidden',
                        socialButtonsBlockButton: 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-700/50 text-white transition-all duration-200',
                        socialButtonsBlockButtonText: 'text-gray-300',
                        dividerRow: 'border-gray-700/50',
                        dividerText: 'text-gray-500',
                        formFieldLabel: 'text-gray-400 text-sm font-medium',
                        formFieldInput: 'border-gray-700/50 bg-gray-800/50 text-white placeholder:text-gray-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200',
                        formButtonPrimary: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all duration-200',
                        footer: 'hidden',
                        identityPreview: 'border-gray-700/50 bg-gray-800/50 text-gray-300',
                        formFieldSuccessMessage: 'text-emerald-400',
                        formFieldErrorMessage: 'text-rose-400',
                        alert: 'border-gray-700/50 bg-gray-800/50 text-gray-300',
                        alertText: 'text-gray-300',
                        otpInput: 'border-gray-700/50 bg-gray-800/50 text-white',
                      },
                      layout: {
                        socialButtonsPlacement: 'top',
                        showOptionalFields: false,
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="mt-8 text-center text-sm text-gray-500"
            >
              By signing in, you agree to our{' '}
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                Privacy Policy
              </a>
            </motion.p>

            {/* Back to home link */}
            <motion.a
              href="/"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-indigo-400 transition-colors group"
            >
              <ArrowRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
              Back to home
            </motion.a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
