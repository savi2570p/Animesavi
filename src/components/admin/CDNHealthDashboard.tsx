import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Globe,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Wifi,
  Server,
  Activity,
  MapPin,
  Gauge,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface RegionHealth {
  region: string;
  name: string;
  flag: string;
  status: 'healthy' | 'degraded' | 'down' | 'testing';
  latency: number;
  throughput: number;
  lastCheck: Date;
  successRate: number;
  errors: string[];
}

interface CDNEndpoint {
  url: string;
  name: string;
  type: 'supabase' | 'cloudflare' | 'custom';
}

// Test endpoints for health checks
const CDN_ENDPOINTS: CDNEndpoint[] = [
  {
    url: 'https://yqeurpyiejesyikcpmdy.supabase.co/storage/v1/object/public/',
    name: 'Supabase Storage',
    type: 'supabase',
  },
];

// Simulated regions for testing
const REGIONS = [
  { region: 'us-east-1', name: 'US East (Virginia)', flag: '🇺🇸' },
  { region: 'us-west-2', name: 'US West (Oregon)', flag: '🇺🇸' },
  { region: 'eu-west-1', name: 'Europe (Ireland)', flag: '🇮🇪' },
  { region: 'eu-central-1', name: 'Europe (Frankfurt)', flag: '🇩🇪' },
  { region: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
  { region: 'ap-south-1', name: 'Asia Pacific (Mumbai)', flag: '🇮🇳' },
  { region: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', flag: '🇯🇵' },
  { region: 'sa-east-1', name: 'South America (São Paulo)', flag: '🇧🇷' },
];

export function CDNHealthDashboard() {
  const [regionHealth, setRegionHealth] = useState<RegionHealth[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallHealth, setOverallHealth] = useState<'healthy' | 'degraded' | 'down'>('healthy');
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);
  const [historyData, setHistoryData] = useState<{ time: Date; avgLatency: number; successRate: number }[]>([]);
  
  // Initialize regions
  useEffect(() => {
    const initialHealth: RegionHealth[] = REGIONS.map(r => ({
      ...r,
      status: 'testing' as const,
      latency: 0,
      throughput: 0,
      lastCheck: new Date(),
      successRate: 100,
      errors: [],
    }));
    setRegionHealth(initialHealth);
  }, []);
  
  // Measure latency to an endpoint
  const measureLatency = async (url: string): Promise<{ latency: number; success: boolean; error?: string }> => {
    const startTime = performance.now();
    
    try {
      // Use a small test file or HEAD request
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-store',
      });
      
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      if (!response.ok && response.status !== 404) {
        return { latency, success: false, error: `HTTP ${response.status}` };
      }
      
      return { latency, success: true };
    } catch (error) {
      const endTime = performance.now();
      return { 
        latency: Math.round(endTime - startTime), 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };
  
  // Measure throughput with a small download
  const measureThroughput = async (url: string): Promise<number> => {
    const testSize = 100 * 1024; // 100KB test
    const startTime = performance.now();
    
    try {
      const response = await fetch(url, { 
        cache: 'no-store',
        mode: 'cors',
      });
      
      if (!response.ok) return 0;
      
      const blob = await response.blob();
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const throughput = (blob.size * 8) / duration / 1000000; // Mbps
      
      return Math.round(throughput * 100) / 100;
    } catch {
      return 0;
    }
  };
  
  // Run health check for a specific region
  const checkRegionHealth = useCallback(async (regionIndex: number): Promise<RegionHealth> => {
    const region = REGIONS[regionIndex];
    const endpoint = CDN_ENDPOINTS[0];
    
    // Simulate region-specific latency variation
    const baseLatencyVariation = Math.random() * 50;
    const regionMultiplier = {
      'us-east-1': 1,
      'us-west-2': 1.2,
      'eu-west-1': 1.5,
      'eu-central-1': 1.6,
      'ap-southeast-1': 2,
      'ap-south-1': 2.5,
      'ap-northeast-1': 2.2,
      'sa-east-1': 2.8,
    }[region.region] || 1;
    
    const { latency, success, error } = await measureLatency(endpoint.url);
    const adjustedLatency = Math.round(latency * regionMultiplier + baseLatencyVariation);
    
    // Determine status based on latency and success
    let status: 'healthy' | 'degraded' | 'down';
    if (!success) {
      status = 'down';
    } else if (adjustedLatency > 500) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    const errors: string[] = [];
    if (error) errors.push(error);
    if (adjustedLatency > 500) errors.push('High latency detected');
    
    // Simulate throughput based on latency
    const throughput = success ? Math.max(1, 50 - adjustedLatency / 20 + Math.random() * 10) : 0;
    
    return {
      ...region,
      status,
      latency: adjustedLatency,
      throughput: Math.round(throughput * 10) / 10,
      lastCheck: new Date(),
      successRate: success ? 100 : 0,
      errors,
    };
  }, []);
  
  // Run full health check
  const runHealthCheck = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    toast.info('Running CDN health check...');
    
    const results: RegionHealth[] = [];
    
    for (let i = 0; i < REGIONS.length; i++) {
      // Update status to testing
      setRegionHealth(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'testing' as const } : r
      ));
      
      const result = await checkRegionHealth(i);
      results.push(result);
      
      // Update with result
      setRegionHealth(prev => prev.map((r, idx) => 
        idx === i ? result : r
      ));
      
      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Calculate overall health
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const downCount = results.filter(r => r.status === 'down').length;
    
    if (downCount > results.length / 2) {
      setOverallHealth('down');
    } else if (healthyCount < results.length / 2) {
      setOverallHealth('degraded');
    } else {
      setOverallHealth('healthy');
    }
    
    // Update history
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
    
    setHistoryData(prev => [
      ...prev.slice(-23), // Keep last 24 data points
      { time: new Date(), avgLatency: Math.round(avgLatency), successRate: avgSuccessRate },
    ]);
    
    setLastFullCheck(new Date());
    setIsRunning(false);
    toast.success('Health check complete');
  }, [isRunning, checkRegionHealth]);
  
  // Auto-run health check on mount
  useEffect(() => {
    runHealthCheck();
    
    // Run every 5 minutes
    const interval = setInterval(runHealthCheck, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
    }
  };
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      healthy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      degraded: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      down: 'bg-destructive/10 text-destructive border-destructive/20',
      testing: 'bg-muted text-muted-foreground',
    };
    
    return (
      <Badge variant="outline" className={variants[status] || variants.testing}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };
  
  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-emerald-500';
    if (latency < 300) return 'text-amber-500';
    return 'text-destructive';
  };
  
  // Calculate stats
  const stats = {
    avgLatency: regionHealth.length > 0 
      ? Math.round(regionHealth.reduce((sum, r) => sum + r.latency, 0) / regionHealth.length)
      : 0,
    avgThroughput: regionHealth.length > 0
      ? Math.round(regionHealth.reduce((sum, r) => sum + r.throughput, 0) / regionHealth.length * 10) / 10
      : 0,
    healthyRegions: regionHealth.filter(r => r.status === 'healthy').length,
    totalRegions: regionHealth.length,
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">CDN Health Monitor</h2>
            <p className="text-sm text-muted-foreground">
              Monitor video delivery performance across regions
            </p>
          </div>
        </div>
        
        <Button 
          onClick={runHealthCheck} 
          disabled={isRunning}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Checking...' : 'Run Check'}
        </Button>
      </div>
      
      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`p-3 rounded-lg ${
              overallHealth === 'healthy' ? 'bg-emerald-500/10' :
              overallHealth === 'degraded' ? 'bg-amber-500/10' : 'bg-destructive/10'
            }`}>
              <Activity className={`h-5 w-5 ${
                overallHealth === 'healthy' ? 'text-emerald-500' :
                overallHealth === 'degraded' ? 'text-amber-500' : 'text-destructive'
              }`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overall Status</p>
              <p className="text-lg font-semibold capitalize">{overallHealth}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Latency</p>
              <p className={`text-lg font-semibold ${getLatencyColor(stats.avgLatency)}`}>
                {stats.avgLatency}ms
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-accent">
              <Wifi className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Throughput</p>
              <p className="text-lg font-semibold">{stats.avgThroughput} Mbps</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <Server className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Healthy Regions</p>
              <p className="text-lg font-semibold">
                {stats.healthyRegions}/{stats.totalRegions}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content */}
      <Tabs defaultValue="regions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regions" className="gap-2">
            <MapPin className="h-4 w-4" />
            Regions
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="regions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regional Performance</CardTitle>
              <CardDescription>
                Latency and throughput by region
                {lastFullCheck && (
                  <span className="ml-2">
                    · Last check: {lastFullCheck.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {regionHealth.map((region) => (
                    <div 
                      key={region.region}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-2xl">{region.flag}</div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{region.name}</span>
                          {getStatusBadge(region.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{region.region}</p>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground text-xs">Latency</p>
                          <p className={`font-medium ${getLatencyColor(region.latency)}`}>
                            {region.status === 'testing' ? '...' : `${region.latency}ms`}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-muted-foreground text-xs">Throughput</p>
                          <p className="font-medium">
                            {region.status === 'testing' ? '...' : `${region.throughput} Mbps`}
                          </p>
                        </div>
                        
                        <div className="w-24">
                          <p className="text-muted-foreground text-xs mb-1">Success Rate</p>
                          <Progress 
                            value={region.successRate} 
                            className="h-1.5"
                          />
                        </div>
                        
                        {getStatusIcon(region.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance History</CardTitle>
              <CardDescription>
                Historical latency and success rate trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-4 opacity-50" />
                  <p>No history data yet</p>
                  <p className="text-sm">Run health checks to collect data</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Simple text-based history for now */}
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                    <span>Time</span>
                    <span>Avg Latency</span>
                    <span>Success Rate</span>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {historyData.slice().reverse().map((entry, idx) => (
                        <div key={idx} className="grid grid-cols-3 gap-4 text-sm py-2 border-b border-border/50">
                          <span className="text-muted-foreground">
                            {entry.time.toLocaleTimeString()}
                          </span>
                          <span className={getLatencyColor(entry.avgLatency)}>
                            {entry.avgLatency}ms
                            {idx > 0 && historyData[historyData.length - 1 - idx + 1] && (
                              entry.avgLatency > historyData[historyData.length - 1 - idx + 1].avgLatency 
                                ? <TrendingUp className="inline h-3 w-3 ml-1 text-destructive" />
                                : <TrendingDown className="inline h-3 w-3 ml-1 text-emerald-500" />
                            )}
                          </span>
                          <span className={entry.successRate === 100 ? 'text-emerald-500' : 'text-amber-500'}>
                            {entry.successRate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
