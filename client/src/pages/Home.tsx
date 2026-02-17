import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Zap, Brain, GitBranch, DollarSign, Server, Shield, Headphones, Sparkles } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Glassmorphism background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-md bg-white/5">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Revvel Skill Runner</h1>
            </div>
            <div className="flex gap-4">
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                      Dashboard
                    </Button>
                  </Link>
                  <span className="text-purple-200 flex items-center">
                    {user?.name || user?.email}
                  </span>
                </>
              ) : (
                <a href={getLoginUrl()}>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    Sign In
                  </Button>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Always-On AI Automation
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                For Your Empire
              </span>
            </h2>
            <p className="text-xl text-purple-200 mb-8 max-w-2xl mx-auto">
              Run 9,692 AI skills on autopilot. Monitor infrastructure. Protect revenue. Automate customer service. 
              All from one glassmorphism dashboard.
            </p>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg px-8 py-6">
                  <Zap className="w-5 h-5 mr-2" />
                  Launch Dashboard
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg px-8 py-6">
                  <Zap className="w-5 h-5 mr-2" />
                  Get Started Free
                </Button>
              </a>
            )}
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Zap className="w-8 h-8" />}
              title="Skill Scheduler"
              description="Run 9,692 skills continuously, on intervals, one-time, or with cron expressions"
              color="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Brain className="w-8 h-8" />}
              title="LLM Model Routing"
              description="11 models across 4 tiers with uncensored options and automatic fallback"
              color="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<GitBranch className="w-8 h-8" />}
              title="GitHub Watcher"
              description="Auto-review repos for inventions, code quality, security, and cleanup needs"
              color="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Sparkles className="w-8 h-8" />}
              title="Innovation Engine"
              description="24/7 idea generation and scoring with eop_innovation_engine"
              color="from-yellow-500 to-orange-500"
            />
            <FeatureCard
              icon={<DollarSign className="w-8 h-8" />}
              title="Affiliate Automation"
              description="Auto-generate content, schedule posts, track conversions, A/B test"
              color="from-pink-500 to-rose-500"
            />
            <FeatureCard
              icon={<Server className="w-8 h-8" />}
              title="Infrastructure Monitor"
              description="Health checks, auto-restart, uptime tracking for all your droplets"
              color="from-indigo-500 to-purple-500"
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Payment Protection"
              description="Fraud detection, dunning, retry logic, and revenue safeguarding"
              color="from-red-500 to-orange-500"
            />
            <FeatureCard
              icon={<Headphones className="w-8 h-8" />}
              title="Customer Service"
              description="Shared widget, AI responses, refunds, subscriptions, support dashboard"
              color="from-teal-500 to-cyan-500"
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-12 max-w-3xl mx-auto">
            <h3 className="text-3xl font-bold text-white mb-4">
              Ready to Automate Everything?
            </h3>
            <p className="text-purple-200 mb-8">
              Join the always-on automation revolution. Deploy skills, monitor infrastructure, and protect revenue — all from one dashboard.
            </p>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                  Start Free
                </Button>
              </a>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 backdrop-blur-md bg-white/5 py-8">
          <div className="container mx-auto px-4 text-center text-purple-300">
            <p>© 2026 Revvel Skill Runner. Built with Manus.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-6 backdrop-blur-md border border-white/20 shadow-lg hover:scale-105 transition-transform`}>
      <div className="text-white mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-white/80 text-sm">{description}</p>
    </div>
  );
}
