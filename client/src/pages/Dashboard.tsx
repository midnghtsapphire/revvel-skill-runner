import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, Trash2, Plus, Search, Zap, Clock, AlertCircle, CheckCircle } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  // Queries
  const skillsQuery = trpc.skills.list.useQuery({
    category: selectedCategory,
    limit: 100,
  });

  const schedulesQuery = trpc.skills.listSchedules.useQuery();
  const categoriesQuery = trpc.skills.categories.useQuery();
  const statsQuery = trpc.skills.dashboardStats.useQuery();

  const searchSkillsQuery = trpc.skills.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  // Mutations
  const createScheduleMutation = trpc.skills.createSchedule.useMutation({
    onSuccess: () => {
      schedulesQuery.refetch();
      statsQuery.refetch();
    },
  });

  const toggleScheduleMutation = trpc.skills.toggleSchedule.useMutation({
    onSuccess: () => {
      schedulesQuery.refetch();
      statsQuery.refetch();
    },
  });

  const skills = searchQuery.length > 0 ? searchSkillsQuery.data : skillsQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Glassmorphism background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Revvel Skill Runner</h1>
          <p className="text-purple-200">Always-on AI automation dashboard</p>
        </div>

        {/* Stats Cards */}
        {statsQuery.data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatsCard
              title="Total Schedules"
              value={statsQuery.data.totalSchedules}
              icon={<Zap className="w-6 h-6" />}
              color="from-purple-500 to-pink-500"
            />
            <StatsCard
              title="Active"
              value={statsQuery.data.activeSchedules}
              icon={<CheckCircle className="w-6 h-6" />}
              color="from-green-500 to-emerald-500"
            />
            <StatsCard
              title="Continuous"
              value={statsQuery.data.continuousSkills}
              icon={<Clock className="w-6 h-6" />}
              color="from-blue-500 to-cyan-500"
            />
            <StatsCard
              title="Errors"
              value={statsQuery.data.errorSkills}
              icon={<AlertCircle className="w-6 h-6" />}
              color="from-red-500 to-orange-500"
            />
          </div>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="skills" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/10 backdrop-blur-md border border-white/20">
            <TabsTrigger value="skills">Skill Browser</TabsTrigger>
            <TabsTrigger value="schedules">Active Schedules</TabsTrigger>
            <TabsTrigger value="models">LLM Models</TabsTrigger>
          </TabsList>

          {/* Skill Browser Tab */}
          <TabsContent value="skills" className="space-y-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
              <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-purple-300" />
                  <Input
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/5 border-white/20 text-white placeholder-purple-300"
                  />
                </div>
                <Select value={selectedCategory || ""} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48 bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categoriesQuery.data?.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skills?.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 hover:border-purple-500/50 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-white">{skill.title}</h3>
                        <p className="text-sm text-purple-300">{skill.name}</p>
                      </div>
                      {skill.category && (
                        <Badge className="bg-purple-500/50 text-purple-100">{skill.category}</Badge>
                      )}
                    </div>
                    {skill.description && (
                      <p className="text-sm text-gray-300 mb-3 line-clamp-2">{skill.description}</p>
                    )}
                    <Button
                      size="sm"
                      onClick={() =>
                        createScheduleMutation.mutate({
                          skillId: skill.id,
                          executionMode: "continuous",
                        })
                      }
                      disabled={createScheduleMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Schedule
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Active Schedules Tab */}
          <TabsContent value="schedules" className="space-y-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
              <div className="space-y-3">
                {schedulesQuery.data?.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between hover:border-purple-500/50 transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">Schedule #{schedule.id}</h3>
                        <Badge
                          className={`${
                            schedule.status === "running"
                              ? "bg-green-500/50"
                              : schedule.status === "error"
                                ? "bg-red-500/50"
                                : "bg-blue-500/50"
                          }`}
                        >
                          {schedule.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-purple-300">
                        Mode: {schedule.executionMode}
                        {schedule.intervalHours && ` (every ${schedule.intervalHours}h)`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleScheduleMutation.mutate({
                            scheduleId: schedule.id,
                            enabled: !schedule.enabled,
                          })
                        }
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        {schedule.enabled ? (
                          <>
                            <Pause className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/20 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* LLM Models Tab */}
          <TabsContent value="models" className="space-y-4">
            <LlmModelsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-6 backdrop-blur-md border border-white/20 shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
        </div>
        <div className="text-white/60">{icon}</div>
      </div>
    </div>
  );
}

function LlmModelsTab() {
  const modelsQuery = trpc.skills.llmModels.useQuery({ tier: undefined });
  const [selectedTier, setSelectedTier] = useState<string | undefined>();

  const models = selectedTier
    ? modelsQuery.data?.filter((m) => m.tier === selectedTier)
    : modelsQuery.data;

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
      <div className="mb-6">
        <Select value={selectedTier || ""} onValueChange={setSelectedTier}>
          <SelectTrigger className="w-48 bg-white/5 border-white/20 text-white">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Tiers</SelectItem>
            <SelectItem value="free-uncensored">Free Uncensored</SelectItem>
            <SelectItem value="paid-uncensored">Paid Uncensored</SelectItem>
            <SelectItem value="free-censored">Free Censored</SelectItem>
            <SelectItem value="paid-censored">Paid Censored</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models?.map((model) => (
          <div key={model.modelId} className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-white">{(model as any).modelName || model.modelId}</h3>
                <p className="text-xs text-purple-300">{model.modelId}</p>
              </div>
              <Badge
                className={`${
                  model.tier.includes("uncensored")
                    ? "bg-red-500/50"
                    : "bg-blue-500/50"
                }`}
              >
                {model.tier}
              </Badge>
            </div>
            {model.description && (
              <p className="text-sm text-gray-300 mb-2">{model.description}</p>
            )}
            <div className="text-xs text-purple-300 space-y-1">
              {model.costPerMTok > 0 && (
                <p>Cost: ${(model.costPerMTok * 1000000).toFixed(4)}/M tokens</p>
              )}
              {model.contextWindow && (
                <p>Context: {model.contextWindow.toLocaleString()} tokens</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
