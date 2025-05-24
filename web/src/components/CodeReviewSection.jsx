"use client"

import JSZip from "jszip"
import { marked } from "marked"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Play,
  Loader2,
  Code2,
  AlertCircle,
  Eye,
} from "lucide-react"

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
}

const REVIEW_TYPES = [
  { value: "general", label: "General Review", description: "Overall code quality and best practices", icon: Code2 },
  { value: "security", label: "Security Audit", description: "Security vulnerabilities and risks", icon: Code2 },
  { value: "performance", label: "Performance", description: "Performance optimization opportunities", icon: Code2 },
  { value: "style", label: "Code Style", description: "Style guidelines and readability", icon: Eye },
  { value: "bugs", label: "Bug Detection", description: "Identify potential bugs and issues", icon: Code2 },
  { value: "docs", label: "Documentation", description: "Documentation quality assessment", icon: Code2 },
  { value: "config", label: "Configuration", description: "Configuration file analysis", icon: Code2 },
  { value: "security-performance", label: "Security & Performance", description: "Combined security and performance review", icon: Code2 },
  { value: "upgrade", label: "Dependencies", description: "Library and framework recommendations", icon: Code2 },
  { value: "tests", label: "Test Coverage", description: "Test quality and coverage analysis", icon: Code2 },
  { value: "refactor", label: "Refactoring", description: "Code structure improvements", icon: Code2 },
  { value: "concurrency", label: "Concurrency", description: "Threading and async patterns", icon: Code2 }
]

// Configure marked for better code review rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false
})

export default function CodeReviewSection({ zipFiles, setZipFiles, selectedReview, setSelectedReview, fileResults, setFileResults, codeProgress, setCodeProgress, isCodeProcessing, setIsCodeProcessing, selectedResult, setSelectedResult }) {
  const handleZipUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || file.type !== "application/zip") return

    try {
      const zip = await JSZip.loadAsync(file)
      const textFiles = {}

      await Promise.all(Object.keys(zip.files).map(async (filename) => {
        const entry = zip.files[filename]
        if (!entry.dir && /\.(js|py|ts|jsx|tsx|json|yaml|yml|html|css|sh|conf|cfg|env|ini|md|txt)$/i.test(filename)) {
          textFiles[filename] = await entry.async("string")
        }
      }))

      setZipFiles(textFiles)
      
      const initialResults = {}
      Object.keys(textFiles).forEach(filename => {
        initialResults[filename] = {
          status: STATUS.PENDING,
          result: null,
          error: null
        }
      })
      setFileResults(initialResults)
      setCodeProgress(0)
    } catch (error) {
      console.error("Error reading ZIP file:", error)
    }
  }

  const reviewSingleFile = async (filename, sourceCode) => {
    try {
      setFileResults(prev => ({
        ...prev,
        [filename]: { ...prev[filename], status: STATUS.PROCESSING }
      }))
      
      const res = await fetch(`http://localhost:5000/api/review/${selectedReview}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          filename: filename,
          source_code: sourceCode
        })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      
      setFileResults(prev => ({
        ...prev,
        [filename]: {
          status: STATUS.COMPLETED,
          result: data.result || "No response received from server",
          error: null
        }
      }))
    } catch (error) {
      console.error(`Error reviewing ${filename}:`, error)
      setFileResults(prev => ({
        ...prev,
        [filename]: {
          status: STATUS.ERROR,
          result: null,
          error: error.message || "Unknown error occurred"
        }
      }))
    }
  }

  const handleCodeReview = async () => {
    if (Object.keys(zipFiles).length === 0) return

    setIsCodeProcessing(true)
    setCodeProgress(0)

    const filenames = Object.keys(zipFiles)
    let completed = 0

    for (const filename of filenames) {
      await reviewSingleFile(filename, zipFiles[filename])
      completed++
      setCodeProgress((completed / filenames.length) * 100)
    }

    setIsCodeProcessing(false)
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
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const renderMarkdownContent = (content) => {
    if (!content) return "No review available"
    
    try {
      const htmlContent = marked(content)
      return (
        <div 
          className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted/50 prose-pre:border prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-li:text-foreground"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )
    } catch (error) {
      console.error("Error parsing markdown:", error)
      // Fallback to plain text display
      return (
        <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg border">
          {content}
        </pre>
      )
    }
  }

  const selectedReviewType = REVIEW_TYPES.find(t => t.value === selectedReview)
  const completedCount = Object.values(fileResults).filter(r => r.status === STATUS.COMPLETED).length
  const errorCount = Object.values(fileResults).filter(r => r.status === STATUS.ERROR).length
  const totalFiles = Object.keys(zipFiles).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Code2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <span>Source Code Security Review</span>
              <div className="flex items-center gap-2 mt-1">
                {totalFiles > 0 && (
                  <>
                    <Badge variant="outline" className="text-xs">
                      {totalFiles} files
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedReviewType?.label}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalFiles > 0 && getStatusIcon(isCodeProcessing ? STATUS.PROCESSING : completedCount === totalFiles ? STATUS.COMPLETED : STATUS.PENDING)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="zip-upload" className="text-sm font-medium">
                Project Archive
              </Label>
              <Input
                id="zip-upload"
                type="file"
                accept=".zip"
                onChange={handleZipUpload}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-muted file:text-sm file:font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Upload a ZIP file containing your source code
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Review Type</Label>
              <Select value={selectedReview} onValueChange={setSelectedReview}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedReviewType && (
                      <div className="flex items-center gap-2">
                        <selectedReviewType.icon className="h-4 w-4" />
                        <span>{selectedReviewType.label}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_TYPES.map((type) => {
                    const IconComponent = type.icon
                    return (
                      <SelectItem key={type.value} value={type.value} className="py-3">
                        <div className="flex items-start gap-3">
                          <IconComponent className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-medium">{type.label}</span>
                            <span className="text-sm text-muted-foreground">{type.description}</span>
                          </div>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalFiles > 0 && (
            <div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{totalFiles}</span>
                      <span className="text-muted-foreground">files found</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{completedCount}</span>
                      <span className="text-muted-foreground">completed</span>
                    </div>
                    {errorCount > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">{errorCount}</span>
                        <span className="text-muted-foreground">errors</span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleCodeReview}
                    disabled={isCodeProcessing || totalFiles === 0}
                    className="flex items-center gap-2"
                  >
                    {isCodeProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isCodeProcessing ? "Processing..." : "Start Code Review"}
                  </Button>
                </div>

                {isCodeProcessing && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Review Progress</span>
                      <span className="font-medium">{Math.round(codeProgress)}%</span>
                    </div>
                    <Progress value={codeProgress} className="h-2" />
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  <Card className="xl:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-lg">Files & Status</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-96">
                        <div className="space-y-1 p-6 pt-0">
                          {Object.entries(fileResults).map(([filename, result]) => (
                            <div
                              key={filename}
                              className={`group p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
                                selectedResult === filename
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-muted-foreground/20'
                              }`}
                              onClick={() => setSelectedResult(filename)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  {getStatusIcon(result.status)}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate" title={filename}>
                                      {filename.split('/').pop()}
                                    </p>
                                    {filename.includes('/') && (
                                      <p className="text-xs text-muted-foreground truncate" title={filename}>
                                        {filename.substring(0, filename.lastIndexOf('/'))}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {getStatusBadge(result.status)}
                              </div>
                              {result.error && (
                                <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-xs text-destructive">
                                  {result.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card className="xl:col-span-3">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {selectedResult ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {selectedResult.split('/').pop()}
                          </div>
                        ) : (
                          "Review Results"
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedResult ? (
                        <Tabs defaultValue="result" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="result" className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              Review
                            </TabsTrigger>
                            <TabsTrigger value="source" className="flex items-center gap-2">
                              <Code2 className="h-4 w-4" />
                              Source
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="result" className="mt-4">
                            <ScrollArea className="h-80">
                              {fileResults[selectedResult]?.status === STATUS.COMPLETED ? (
                                <div className="p-4 bg-muted/20 rounded-lg border">
                                  {renderMarkdownContent(fileResults[selectedResult]?.result)}
                                </div>
                              ) : fileResults[selectedResult]?.status === STATUS.ERROR ? (
                                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <XCircle className="h-5 w-5 text-destructive" />
                                    <p className="font-medium text-destructive">Review Failed</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {fileResults[selectedResult]?.error || "Unknown error occurred"}
                                  </p>
                                </div>
                              ) : fileResults[selectedResult]?.status === STATUS.PROCESSING ? (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                    <span className="text-blue-700 font-medium">Review in progress...</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-5 w-5" />
                                    <span>Review pending. Click "Start Review" to begin.</span>
                                  </div>
                                </div>
                              )}
                            </ScrollArea>
                          </TabsContent>
                          <TabsContent value="source" className="mt-4">
                            <ScrollArea className="h-80">
                              <pre className="text-sm p-4 bg-muted/30 rounded-lg border whitespace-pre-wrap font-mono">
                                {zipFiles[selectedResult]}
                              </pre>
                            </ScrollArea>
                          </TabsContent>
                        </Tabs>
                      ) : (
                        <div className="h-80 flex items-center justify-center">
                          <div className="text-center space-y-3">
                            <div className="p-4 bg-muted/30 rounded-full w-fit mx-auto">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground">No file selected</p>
                              <p className="text-sm text-muted-foreground">
                                Choose a file from the list to view its review results
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}