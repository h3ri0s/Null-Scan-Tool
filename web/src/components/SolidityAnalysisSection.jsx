"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Loader2,
  FileCode,
  Shield,
  AlertTriangle,
  Bug,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Upload,
  Code,
  Info
} from "lucide-react"

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
}

const ANALYSIS_STEPS = [
  { id: 'upload', label: 'File Processing', icon: Upload },
  { id: 'syntax', label: 'Syntax Check', icon: Code },
  { id: 'security', label: 'Security Analysis', icon: Shield },
  { id: 'vulnerabilities', label: 'Vulnerability Detection', icon: Bug },
  { id: 'report', label: 'Report Generation', icon: FileCode }
]

export default function SolidityAnalysisSection({ 
  solidityConfig, 
  setSolidityConfig, 
  solidityResults, 
  setSolidityResults, 
  solidityProgress, 
  setSolidityProgress, 
  solidityStatus, 
  setSolidityStatus, 
  currentAnalysisStep, 
  setCurrentAnalysisStep, 
  onComplete 
}) {
  const [inputMode, setInputMode] = useState('file') // 'file' or 'code'
  const [expandedFindings, setExpandedFindings] = useState({})
  const fileInputRef = useRef(null)

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSolidityConfig(prev => ({ ...prev, file, fileName: file.name }))
    }
  }

  const handleCodeChange = (event) => {
    setSolidityConfig(prev => ({ ...prev, contractCode: event.target.value }))
  }

  const handleContractNameChange = (event) => {
    setSolidityConfig(prev => ({ ...prev, contractName: event.target.value }))
  }

  const extractFindingsFromResults = (results) => {
    const findings = {
      high: [],
      medium: [],
      low: [],
      informational: [],
      optimization: []
    }

    console.log(results)

    if (results.vulnerabilities && Array.isArray(results.vulnerabilities)) {
      results.vulnerabilities.forEach(vuln => {
        const impact = vuln.impact?.toLowerCase() || 'informational'

        const finding = {
          id: vuln.id || 'unknown',
          title: vuln.description || 'No description available',
          impact: vuln.impact || 'Unknown',
          confidence: vuln.confidence || 'Medium',
          type: vuln.type || 'unknown',
          patch: vuln.patch || 'No patch provided'
        }

        switch (impact) {
          case 'high':
            findings.high.push(finding)
            break
          case 'medium':
            findings.medium.push(finding)
            break
          case 'low':
            findings.low.push(finding)
            break
          case 'optimization':
            findings.optimization.push(finding)
            break
          default:
            findings.informational.push(finding)
        }
      })
    }

    return findings
  }

  const handleSolidityAnalysis = async () => {
    if (inputMode === 'file' && !solidityConfig.file) return
    if (inputMode === 'code' && !solidityConfig.contractCode?.trim()) return

    setSolidityStatus(STATUS.PROCESSING)
    setSolidityProgress(0)
    setCurrentAnalysisStep(0)

    try {
      // Simulate progress through analysis steps
      for (let i = 0; i < ANALYSIS_STEPS.length - 1; i++) {
        setCurrentAnalysisStep(i)
        setSolidityProgress((i / ANALYSIS_STEPS.length) * 80)
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      let response
      
      if (inputMode === 'file') {
        // File upload mode
        const formData = new FormData()
        formData.append('file', solidityConfig.file)
        
        response = await fetch('http://localhost:5000/api/solidity/analyze', {
          method: 'POST',
          body: formData
        })
      } else {
        // Code input mode
        response = await fetch('http://localhost:5000/api/solidity/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_code: solidityConfig.contractCode,
            contract_name: solidityConfig.contractName || 'contract.sol'
          })
        })
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Solidity analysis results:', data)
      setSolidityResults(data)
      setSolidityProgress(80)

      // Complete analysis
      setCurrentAnalysisStep(4) // Report generation step
      setSolidityProgress(100)
      setSolidityStatus(STATUS.COMPLETED)

      setTimeout(() => {
        onComplete()
      }, 1000)
    } catch (error) {
      console.error('Solidity analysis error:', error)
      setSolidityStatus(STATUS.ERROR)
      setSolidityResults({ error: error.message })
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

  const getSeverityColor = (impact) => {
    switch (impact?.toUpperCase()) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'MEDIUM':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'LOW':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'INFORMATIONAL':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'OPTIMIZATION':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const toggleFindingExpansion = (index) => {
    setExpandedFindings(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const getFileName = () => {
    if (inputMode === 'file' && solidityConfig.fileName) {
      return solidityConfig.fileName
    }
    if (inputMode === 'code' && solidityConfig.contractName) {
      return solidityConfig.contractName
    }
    return 'Contract'
  }

  const canStartAnalysis = () => {
    if (inputMode === 'file') {
      return solidityConfig.file && solidityStatus !== STATUS.PROCESSING
    }
    return solidityConfig.contractCode?.trim() && solidityStatus !== STATUS.PROCESSING
  }

  // Extract findings from results
  const findings = solidityResults ? extractFindingsFromResults(solidityResults) : null
  const totalFindings = findings ? 
    findings.high.length + findings.medium.length + findings.low.length + 
    findings.informational.length + findings.optimization.length : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <FileCode className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <span>Solidity Security Analysis</span>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(solidityStatus)}
                {getFileName() && (
                  <Badge variant="outline" className="text-xs">
                    {getFileName()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(solidityStatus)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Input Mode Selection */}
          <div className="flex gap-2">
            <Button
              variant={inputMode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('file')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
            <Button
              variant={inputMode === 'code' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('code')}
            >
              <Code className="h-4 w-4 mr-2" />
              Paste Code
            </Button>
          </div>

          {/* File Upload Mode */}
          {inputMode === 'file' && (
            <div className="space-y-2">
              <Label htmlFor="contract-file">Solidity Contract File (.sol)</Label>
              <Input
                id="contract-file"
                type="file"
                accept=".sol"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {solidityConfig.fileName && (
                <p className="text-sm text-muted-foreground">
                  Selected: {solidityConfig.fileName}
                </p>
              )}
            </div>
          )}

          {/* Code Input Mode */}
          {inputMode === 'code' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contract-name">Contract Name (optional)</Label>
                <Input
                  id="contract-name"
                  placeholder="MyContract.sol"
                  value={solidityConfig.contractName || ''}
                  onChange={handleContractNameChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-code">Solidity Contract Code</Label>
                <Textarea
                  id="contract-code"
                  placeholder="pragma solidity ^0.8.0;&#10;&#10;contract MyContract {&#10;    // Your contract code here&#10;}"
                  value={solidityConfig.contractCode || ''}
                  onChange={handleCodeChange}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              onClick={handleSolidityAnalysis}
              disabled={!canStartAnalysis()}
              className="flex items-center gap-2"
            >
              {solidityStatus === STATUS.PROCESSING ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {solidityStatus === STATUS.PROCESSING ? "Analyzing..." : "Start Security Analysis"}
            </Button>

            {solidityStatus === STATUS.PROCESSING && (
              <div className="text-sm text-muted-foreground">
                Step {currentAnalysisStep + 1} of {ANALYSIS_STEPS.length}: {ANALYSIS_STEPS[currentAnalysisStep]?.label}
              </div>
            )}
          </div>

          {solidityStatus === STATUS.PROCESSING && (
            <div className="space-y-3">
              <Progress value={solidityProgress} className="h-2" />
              <div className="grid grid-cols-5 gap-2">
                {ANALYSIS_STEPS.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = index === currentAnalysisStep
                  const isCompleted = index < currentAnalysisStep
                  
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

          {solidityStatus === STATUS.COMPLETED && solidityResults && findings && (
            <div className="space-y-4">
              <Separator />
              
              {/* Analysis Summary */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">High Risk</span>
                    </div>
                    <p className="text-2xl font-bold mt-1 text-red-600">
                      {findings.high.length}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Medium Risk</span>
                    </div>
                    <p className="text-2xl font-bold mt-1 text-orange-600">
                      {findings.medium.length}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium">Low Risk</span>
                    </div>
                    <p className="text-2xl font-bold mt-1 text-yellow-600">
                      {findings.low.length}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Info</span>
                    </div>
                    <p className="text-2xl font-bold mt-1 text-blue-600">
                      {findings.informational.length}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Optimization</span>
                    </div>
                    <p className="text-2xl font-bold mt-1 text-green-600">
                      {findings.optimization.length}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Security Findings */}
              {totalFindings > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Security Findings ({totalFindings})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-96">
                      <div className="space-y-3">
                        {/* High Risk Findings */}
                        {findings.high.map((finding, index) => {
                          const findingKey = `high-${index}`
                          const isExpanded = expandedFindings[findingKey]
                          
                          return (
                            <div key={findingKey} className="border rounded-lg p-3 border-red-200 bg-red-50">
                              <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleFindingExpansion(findingKey)}
                              >
                                <div className="flex items-center gap-3">
                                  <Badge className={getSeverityColor(finding.impact)}>
                                    {finding.impact}
                                  </Badge>
                                  <div>
                                    <p className="font-medium text-red-800">{finding.id}</p>
                                    <p className="text-sm text-red-700">
                                      {finding.title.length > 100 
                                        ? `${finding.title.substring(0, 100)}...` 
                                        : finding.title}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {finding.confidence} Confidence
                                  </Badge>
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                              </div>
                              
                              {isExpanded && finding.markdown && (
                                <div className="mt-3 pt-3 border-t border-red-200">
                                  <div className="text-sm text-red-800 whitespace-pre-wrap">
                                    {finding.markdown}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Medium Risk Findings */}
                        {findings.medium.map((finding, index) => {
                          const findingKey = `medium-${index}`
                          const isExpanded = expandedFindings[findingKey]
                          
                          return (
                            <div key={findingKey} className="border rounded-lg p-3 border-orange-200 bg-orange-50">
                              <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleFindingExpansion(findingKey)}
                              >
                                <div className="flex items-center gap-3">
                                  <Badge className={getSeverityColor(finding.impact)}>
                                    {finding.impact}
                                  </Badge>
                                  <div>
                                    <p className="font-medium text-orange-800">{finding.id}</p>
                                    <p className="text-sm text-orange-700">
                                      {finding.title.length > 100 
                                        ? `${finding.title.substring(0, 100)}...` 
                                        : finding.title}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {finding.confidence} Confidence
                                  </Badge>
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                              </div>
                              
                              {isExpanded && finding.markdown && (
                                <div className="mt-3 pt-3 border-t border-orange-200">
                                  <div className="text-sm text-orange-800 whitespace-pre-wrap">
                                    {finding.markdown}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Low Risk and Other Findings */}
                        {[...findings.low, ...findings.informational, ...findings.optimization].map((finding, index) => {
                          const findingKey = `other-${index}`
                          const isExpanded = expandedFindings[findingKey]
                          
                          return (
                            <div key={findingKey} className="border rounded-lg p-3">
                              <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleFindingExpansion(findingKey)}
                              >
                                <div className="flex items-center gap-3">
                                  <Badge className={getSeverityColor(finding.impact)}>
                                    {finding.impact}
                                  </Badge>
                                  <div>
                                    <p className="font-medium">{finding.id}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {finding.title.length > 100 
                                        ? `${finding.title.substring(0, 100)}...` 
                                        : finding.title}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {finding.confidence} Confidence
                                  </Badge>
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                              </div>
                              
                              {isExpanded && finding.markdown && (
                                <div className="mt-3 pt-3 border-t">
                                  <div className="text-sm whitespace-pre-wrap">
                                    {finding.markdown}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Analysis Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      Analysis Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Contract:</span>
                        <span className="font-medium">{solidityResults.contract_file}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>File Size:</span>
                        <span className="font-medium">{solidityResults.file_size} bytes</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Timestamp:</span>
                        <span className="font-medium">{solidityResults.timestamp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={solidityResults.status === 'success' ? 'default' : 'destructive'}>
                          {solidityResults.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      Risk Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {findings.high.length > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-red-600">High Risk Issues:</span>
                          <Badge variant="destructive">{findings.high.length}</Badge>
                        </div>
                      )}
                      {findings.medium.length > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-orange-600">Medium Risk Issues:</span>
                          <Badge className="bg-orange-100 text-orange-800">{findings.medium.length}</Badge>
                        </div>
                      )}
                      {totalFindings === 0 && (
                        <p className="text-muted-foreground">No security issues detected</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {solidityStatus === STATUS.ERROR && (
            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <p className="font-medium text-destructive">Analysis Failed</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {solidityResults?.error || "Unknown error occurred"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}