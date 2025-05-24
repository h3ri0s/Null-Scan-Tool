"use client";

import APKAnalyzerSection from "@/components/APKAnalyzerSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCode, Shield } from "lucide-react";

export default function APKAnalysisPage() {
  return (
    <div className="container mx-auto p-4 min-h-screen">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">APK NULL</h1>
              <p className="text-sm text-muted-foreground">
                Upload an APK file to analyze its security, including manifest, backup rules, strings, and Java code vulnerabilities.
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <APKAnalyzerSection />
        </CardContent>
      </Card>
    </div>
  );
}