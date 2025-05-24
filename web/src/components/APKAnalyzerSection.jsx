"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Loader2,
  FileCode,
  Shield,
  AlertTriangle,
  Bug
} from "lucide-react";

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

const SCAN_STEPS = [
  { id: 'decompile', label: 'APK Decompilation', icon: FileCode },
  { id: 'manifest', label: 'Manifest Analysis', icon: Shield },
  { id: 'backup_rules', label: 'Backup Rules Analysis', icon: Shield },
  { id: 'strings', label: 'Strings Analysis', icon: FileCode },
  { id: 'hardcoded', label: 'Hardcoded Strings Check', icon: AlertTriangle },
  { id: 'java', label: 'Java Code Analysis', icon: Bug }
];

export default function APKAnalyzerSection() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(STATUS.PENDING);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.apk')) {
      setFile(selectedFile);
      setStatus(STATUS.PENDING);
      setResults(null);
      setError(null);
    } else {
      setError('Please select a valid APK file (.apk extension)');
      setFile(null);
      setStatus(STATUS.ERROR);
      setResults(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('No file selected');
      setStatus(STATUS.ERROR);
      return;
    }

    setStatus(STATUS.PROCESSING);
    setProgress(0);
    setCurrentStep(0);
    setError(null);

    const formData = new FormData();
    formData.append('apk_file', file);

    try {
      // Simulate progress through steps
      for (let i = 0; i < SCAN_STEPS.length; i++) {
        setCurrentStep(i);
        setProgress((i / SCAN_STEPS.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const response = await fetch('http://localhost:5000/api/apk-analyzer/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
      setStatus(STATUS.COMPLETED);
      setProgress(100);
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message || 'An unexpected error occurred');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case STATUS.PENDING:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case STATUS.PROCESSING:
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case STATUS.COMPLETED:
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case STATUS.ERROR:
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      [STATUS.PENDING]: { variant: "secondary", className: "bg-secondary text-secondary-foreground" },
      [STATUS.PROCESSING]: { variant: "default", className: "bg-blue-50 text-blue-700 border-blue-200" },
      [STATUS.COMPLETED]: { variant: "default", className: "bg-green-50 text-green-700 border-green-200" },
      [STATUS.ERROR]: { variant: "destructive", className: "bg-destructive/10 text-destructive border-destructive/20" }
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FileCode className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <span>APK Security Analysis</span>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(status)}
                {file && (
                  <Badge variant="outline" className="text-xs">
                    {file.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apk-file">Upload APK File</Label>
            <Input
              id="apk-file"
              type="file"
              accept=".apk"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={handleAnalyze}
              disabled={status === STATUS.PROCESSING || !file}
              className="flex items-center gap-2"
            >
              {status === STATUS.PROCESSING ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {status === STATUS.PROCESSING ? "Analyzing..." : "Start Analysis"}
            </Button>

            {status === STATUS.PROCESSING && (
              <div className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {SCAN_STEPS.length}: {SCAN_STEPS[currentStep]?.label}
              </div>
            )}
          </div>

          {status === STATUS.PROCESSING && (
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {SCAN_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;

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
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status === STATUS.COMPLETED && results && (
            <div className="space-y-4">
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Manifest Issues</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {results.scan_summary?.issues_found.manifest_issues || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Backup Issues</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {results.scan_summary?.issues_found.backup_extraction_issues || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">Java Vulnerabilities</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {results.scan_summary?.issues_found.java_vulnerabilities || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Hardcoded Strings</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {results.scan_summary?.issues_found.hardcoded_strings || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Detailed Findings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-3">
                      {results.scan_summary?.issues_found.manifest_issues > 0 && (
                        <div>
                          <h3 className="font-medium">Manifest Issues</h3>
                          {results.detailed_results?.manifest_analysis.analyses.map((analysis, index) => (
                            <div key={index} className="p-2 border rounded">
                              <p className="text-sm font-medium">{analysis.file}</p>
                              {analysis.issues.map((issue, idx) => (
                                <div key={idx} className="text-sm">
                                  <p><strong>{issue.issue}</strong> ({issue.severity})</p>
                                  <p>{issue.description}</p>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {results.scan_summary?.issues_found.backup_extraction_issues > 0 && (
                        <div>
                          <h3 className="font-medium">Backup/Extraction Issues</h3>
                          {results.detailed_results?.backup_extraction_analysis.analyses.map((analysis, index) => (
                            <div key={index} className="p-2 border rounded">
                              {analysis.issues.map((issue, idx) => (
                                <div key={idx} className="text-sm">
                                  <p><strong>{issue.type}</strong> ({issue.path})</p>
                                  <p>{issue.description}</p>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {results.scan_summary?.issues_found.java_vulnerabilities > 0 && (
                        <div>
                          <h3 className="font-medium">Java Vulnerabilities</h3>
                          {results.detailed_results?.java_analysis.analyses.map((analysis, index) => (
                            <div key={index} className="p-2 border rounded">
                              <p className="text-sm font-medium">{analysis.file}</p>
                              {analysis.vulnerabilities.map((vuln, idx) => (
                                <div key={idx} className="text-sm">
                                  <p><strong>{vuln.vulnerability_type}</strong> ({vuln.severity})</p>
                                  <p>{vuln.description}</p>
                                  <pre className="text-xs p-2 rounded">{vuln.code_snippet}</pre>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {results.scan_summary?.issues_found.hardcoded_strings > 0 && (
                        <div>
                          <h3 className="font-medium">Hardcoded Strings</h3>
                          {Object.entries(results.detailed_results?.hardcoded_strings_analysis.hardcoded_strings).map(([file, issues], index) => (
                            <div key={index} className="p-2 border rounded">
                              <p className="text-sm font-medium">{file}</p>
                              {Array.isArray(issues) && issues.map((issue, idx) => (
                                <div key={idx} className="text-sm">
                                  <p><strong>{issue.attribute}</strong> (Line {issue.line})</p>
                                  <p>{issue.value}</p>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {status === STATUS.ERROR && !error && (
            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <p className="font-medium text-destructive">Analysis Failed</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Unknown error occurred
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}