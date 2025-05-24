"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Loader2,
  Network,
  Server,
  Shield,
  AlertTriangle,
  Bug,
  ExternalLink,
  ChevronDown,
  ChevronRight
} from "lucide-react"

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
}

const SCAN_STEPS = [
  { id: 'port_scan', label: 'Port Scanning', icon: Network },
  { id: 'ssl_check', label: 'SSL Security', icon: Shield },
  { id: 'http_check', label: 'HTTP Security', icon: Shield },
  { id: 'vulnerability', label: 'Vulnerability Assessment', icon: Shield },
  { id: 'cve_lookup', label: 'CVE Analysis', icon: Bug }
]

export default function NetworkScanSection({ 
  networkConfig, 
  setNetworkConfig, 
  networkResults, 
  setNetworkResults, 
  networkProgress, 
  setNetworkProgress, 
  networkStatus, 
  setNetworkStatus, 
  currentScanStep, 
  setCurrentScanStep, 
  onComplete 
}) {
  const [cveData, setCveData] = useState({})
  const [cveLoading, setCveLoading] = useState(false)
  const [expandedPorts, setExpandedPorts] = useState({})

  const extractProductsFromScanResults = (results) => {
    const products = []
    
    // Handle new structure with port_scan.tcp
    if (results.port_scan?.tcp) {
      Object.entries(results.port_scan.tcp).forEach(([port, info]) => {
        if (info.product && info.product.trim()) {
          const product = info.product.trim()
          const version = info.version ? info.version.trim() : ''
          products.push({
            port,
            product,
            version,
            service: info.name || 'unknown'
          })
        }
      })
    }
    
    // Fallback to old structure if present
    if (results.tcp) {
      Object.entries(results.tcp).forEach(([port, info]) => {
        if (info.product && info.product.trim()) {
          const product = info.product.trim()
          const version = info.version ? info.version.trim() : ''
          products.push({
            port,
            product,
            version,
            service: info.name || 'unknown'
          })
        }
      })
    }
    
    return products
  }

  const fetchCveData = async (products) => {
    setCveLoading(true)
    const cveResults = {}
    
    try {
      for (const productInfo of products) {
        if (productInfo.product) {
          console.log(`Fetching CVE data for: ${productInfo.product}`)
          
          const response = await fetch('http://localhost:5000/api/cve/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              module_name: productInfo.product,
              version: productInfo.version
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            cveResults[productInfo.product] = {
              ...data,
              port: productInfo.port,
              service: productInfo.service,
              version: productInfo.version
            }
          } else {
            console.error(`Failed to fetch CVE for ${productInfo.product}`)
            cveResults[productInfo.product] = {
              cves: [],
              error: 'Failed to fetch CVE data',
              port: productInfo.port,
              service: productInfo.service,
              version: productInfo.version
            }
          }
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    } catch (error) {
      console.error('Error fetching CVE data:', error)
    } finally {
      setCveLoading(false)
    }
    
    return cveResults
  }

  const handleNetworkScan = async () => {
    if (!networkConfig.target) return

    setNetworkStatus(STATUS.PROCESSING)
    setNetworkProgress(0)
    setCurrentScanStep(0)
    setCveData({})

    try {
      // Simulate progress through scan steps
      for (let i = 0; i < SCAN_STEPS.length - 1; i++) {
        setCurrentScanStep(i)
        setNetworkProgress((i / SCAN_STEPS.length) * 80)
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      const response = await fetch('http://localhost:5000/api/network-scan/full_scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: networkConfig.target,
          ports: networkConfig.ports,
          chunk_size: networkConfig.chunkSize
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Network scan results:', data)
      setNetworkResults(data)
      setNetworkProgress(80)

      // Extract products and fetch CVE data
      setCurrentScanStep(4) // CVE lookup step
      const products = extractProductsFromScanResults(data)
      
      if (products.length > 0) {
        console.log('Found products to check for CVEs:', products)
        const cveResults = await fetchCveData(products)
        setCveData(cveResults)
      }

      setNetworkStatus(STATUS.COMPLETED)
      setNetworkProgress(100)

      setTimeout(() => {
        onComplete()
      }, 1000)
    } catch (error) {
      console.error('Network scan error:', error)
      setNetworkStatus(STATUS.ERROR)
      setNetworkResults({ error: error.message })
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case STATUS.PENDING:
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case STATUS.PROCESSING:
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case STATUS.COMPLETED:
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case STATUS.ERROR:
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      [STATUS.PENDING]: { variant: "secondary", className: "bg-secondary text-secondary-foreground" },
      [STATUS.PROCESSING]: { variant: "default", className: "bg-blue-50 text-blue-700 border-blue-200" },
      [STATUS.COMPLETED]: { variant: "default", className: "bg-green-50 text-green-700 border-green-200" },
      [STATUS.ERROR]: { variant: "destructive", className: "bg-destructive/10 text-destructive border-destructive/20" }
    }
  
    const config = statusConfig[status]
    if (!config) {
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Unknown
        </Badge>
      )
    }
  
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }
  
  const getSeverityColor = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const togglePortExpansion = (port) => {
    setExpandedPorts(prev => ({
      ...prev,
      [port]: !prev[port]
    }))
  }

  // Helper function to get port data from either new or old structure
  const getPortData = (results) => {
    if (results.port_scan?.tcp) {
      return results.port_scan.tcp
    }
    if (results.tcp) {
      return results.tcp
    }
    return {}
  }

  // Helper function to count total errors
  const getTotalErrors = (results) => {
    if (results.errors && Array.isArray(results.errors)) {
      return results.errors.length
    }
    return 0
  }

  // Helper function to count security findings
  const getSecurityFindingsCount = (results) => {
    let sslCount = 0
    let httpCount = 0
    
    if (results.ssl_security_findings && typeof results.ssl_security_findings === 'object') {
      sslCount = Object.keys(results.ssl_security_findings).length
    }
    
    if (results.http_security_findings && typeof results.http_security_findings === 'object') {
      httpCount = Object.keys(results.http_security_findings).length
    }
    
    return { sslCount, httpCount }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Network className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <span>Network Security Scan</span>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(networkStatus)}
                {networkConfig.target && (
                  <Badge variant="outline" className="text-xs">
                    {networkConfig.target}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(networkStatus)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target">Target IP/Hostname</Label>
              <Input
                id="target"
                placeholder="192.168.1.1 or example.com"
                value={networkConfig.target}
                onChange={(e) => setNetworkConfig(prev => ({ ...prev, target: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ports">Port Range</Label>
              <Input
                id="ports"
                placeholder="1-1000 or 80,443,8080"
                value={networkConfig.ports}
                onChange={(e) => setNetworkConfig(prev => ({ ...prev, ports: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chunk-size">Chunk Size</Label>
              <Input
                id="chunk-size"
                type="number"
                value={networkConfig.chunkSize}
                onChange={(e) => setNetworkConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={handleNetworkScan}
              disabled={networkStatus === STATUS.PROCESSING || !networkConfig.target}
              className="flex items-center gap-2"
            >
              {networkStatus === STATUS.PROCESSING ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {networkStatus === STATUS.PROCESSING ? "Scanning..." : "Start Network Scan"}
            </Button>

            {networkStatus === STATUS.PROCESSING && (
              <div className="text-sm text-muted-foreground">
                Step {currentScanStep + 1} of {SCAN_STEPS.length}: {SCAN_STEPS[currentScanStep]?.label}
              </div>
            )}
          </div>

          {networkStatus === STATUS.PROCESSING && (
            <div className="space-y-3">
              <Progress value={networkProgress} className="h-2" />
              <div className="grid grid-cols-5 gap-2">
                {SCAN_STEPS.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = index === currentScanStep
                  const isCompleted = index < currentScanStep
                  
                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-lg border text-center ${
                        isActive ? 'border-primary bg-primary/5' :
                        isCompleted ? 'border-green-200 bg-green-50' :
                        'border-muted bg-muted/30'
                      }`}
                    >
                      <StepIcon className={`h-4 w-4 mx-auto mb-1 ${
                        isActive ? 'text-primary' :
                        isCompleted ? 'text-green-600' :
                        'text-muted-foreground'
                      }`} />
                      <p className="text-xs font-medium">{step.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {cveLoading && (
            <Alert>
              <Bug className="h-4 w-4" />
              <AlertDescription>
                Fetching CVE data for detected services... This may take a few moments.
              </AlertDescription>
            </Alert>
          )}

          {networkStatus === STATUS.COMPLETED && networkResults && (
            <div className="space-y-4">
              <Separator />
              
              {/* Scan Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Open Ports</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {Object.keys(getPortData(networkResults)).length}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">SSL Issues</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {getSecurityFindingsCount(networkResults).sslCount}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">HTTP Issues</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {getSecurityFindingsCount(networkResults).httpCount}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">CVEs Found</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {Object.values(cveData).reduce((total, data) => total + (data.cves?.length || 0), 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Open Ports with Enhanced Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Open Ports & Services
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-3">
                      {Object.entries(getPortData(networkResults)).map(([port, info]) => {
                        const hasProduct = info.product && info.product.trim()
                        const hasCveData = hasProduct && cveData[info.product]
                        const cveCount = hasCveData ? cveData[info.product].cves?.length || 0 : 0
                        const isExpanded = expandedPorts[port]
                        
                        return (
                          <div key={port} className="border rounded-lg p-3">
                            <div 
                              className="flex items-center justify-between cursor-pointer"
                              onClick={() => togglePortExpansion(port)}
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="font-mono">
                                  {port}
                                </Badge>
                                <div>
                                  <p className="font-medium">{info.name || 'Unknown Service'}</p>
                                  {hasProduct && (
                                    <p className="text-sm text-muted-foreground">
                                      {info.product} {info.version && `v${info.version}`}
                                    </p>
                                  )}
                                  {info.extrainfo && (
                                    <p className="text-xs text-muted-foreground">
                                      {info.extrainfo}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {info.state}
                                </Badge>
                                {cveCount > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {cveCount} CVEs
                                  </Badge>
                                )}
                                {hasProduct ? (
                                  isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                                ) : null}
                              </div>
                            </div>
                            
                            {isExpanded && hasCveData && (
                              <div className="mt-3 pt-3 border-t">
                                <div className="flex items-center gap-2 mb-2">
                                  <Bug className="h-4 w-4 text-red-600" />
                                  <span className="font-medium text-sm">Vulnerabilities Found</span>
                                </div>
                                <ScrollArea className="max-h-48">
                                  <div className="space-y-2">
                                    {cveData[info.product].cves?.map((cve, index) => (
                                      <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium text-red-800">{cve.id}</span>
                                          <a 
                                            href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        </div>
                                        <p className="text-gray-700 text-xs">
                                          {cve.description.length > 150 
                                            ? `${cve.description.substring(0, 150)}...` 
                                            : cve.description}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Errors Section */}
              {getTotalErrors(networkResults) > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Scan Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-32">
                      <div className="space-y-2">
                        {networkResults.errors.map((error, index) => (
                          <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            {error}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Security Findings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Security Findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32">
                      <div className="space-y-2 text-sm">
                        {getSecurityFindingsCount(networkResults).sslCount > 0 && (
                          <div className="p-2 bg-orange-50 text-black border border-orange-200 rounded">
                            SSL Issues: {getSecurityFindingsCount(networkResults).sslCount}
                          </div>
                        )}
                        {getSecurityFindingsCount(networkResults).httpCount > 0 && (
                          <div className="p-2 bg-red-50 text-black border border-red-200 rounded">
                            HTTP Issues: {getSecurityFindingsCount(networkResults).httpCount}
                          </div>
                        )}
                        {getSecurityFindingsCount(networkResults).sslCount === 0 && 
                         getSecurityFindingsCount(networkResults).httpCount === 0 && (
                          <p className="text-muted-foreground">No security issues detected</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      CVE Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.keys(cveData).length > 0 ? (
                        Object.entries(cveData).map(([product, data]) => (
                          <div key={product} className="flex justify-between items-center">
                            <span className="font-medium">{product}</span>
                            <Badge variant={data.cves?.length > 0 ? "destructive" : "secondary"}>
                              {data.cves?.length || 0} CVEs
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">No services with version info detected</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {networkStatus === STATUS.ERROR && (
            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <p className="font-medium text-destructive">Network Scan Failed</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {networkResults?.error || "Unknown error occurred"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}