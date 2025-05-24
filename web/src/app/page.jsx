"use client"

import { useState } from "react"
import { Shield } from "lucide-react"
import NetworkScanSection from "@/components/NetworkScanSection"
import CodeReviewSection from "@/components/CodeReviewSection"
import SecurityReportExporter from "@/components/SecurityReportExporter"
import SolidityAnalysisSection from "@/components/SolidityAnalysisSection"

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
}

export default function SecurityScanningTool() {
  const [networkConfig, setNetworkConfig] = useState({
    target: '',
    ports: '1-1000',
    chunkSize: 1000
  })

  const [solidityConfig, setSolidityConfig] = useState({
    file: null,
    fileName: '',
    contractCode: '',
    contractName: ''
  })
  const [solidityResults, setSolidityResults] = useState(null)
  const [solidityProgress, setSolidityProgress] = useState(0)
  const [solidityStatus, setSolidityStatus] = useState('pending')
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState(0)
  
  const handleComplete = () => {
    console.log('Analysis completed!')
  }

  const [networkResults, setNetworkResults] = useState({})
  const [networkProgress, setNetworkProgress] = useState(0)
  const [networkStatus, setNetworkStatus] = useState(STATUS.PENDING)
  const [currentScanStep, setCurrentScanStep] = useState(0)

  const [zipFiles, setZipFiles] = useState({})
  const [selectedReview, setSelectedReview] = useState("security")
  const [fileResults, setFileResults] = useState({})
  const [codeProgress, setCodeProgress] = useState(0)
  const [isCodeProcessing, setIsCodeProcessing] = useState(false)
  const [selectedResult, setSelectedResult] = useState(null)

  const [networkScanOpen, setNetworkScanOpen] = useState(true)
  const [codeScanOpen, setCodeScanOpen] = useState(false)

  const handleNetworkScanComplete = () => {
    setNetworkScanOpen(false)
    setCodeScanOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">NULL Scan</h1>
              <p className="text-muted-foreground">Comprehensive network and code security analysis</p>
            </div>
          </div>
        </div>

        <NetworkScanSection
          networkConfig={networkConfig}
          setNetworkConfig={setNetworkConfig}
          networkResults={networkResults}
          setNetworkResults={setNetworkResults}
          networkProgress={networkProgress}
          setNetworkProgress={setNetworkProgress}
          networkStatus={networkStatus}
          setNetworkStatus={setNetworkStatus}
          currentScanStep={currentScanStep}
          setCurrentScanStep={setCurrentScanStep}
          onComplete={handleNetworkScanComplete}
        />

        <div className="mt-6">
          <CodeReviewSection
            zipFiles={zipFiles}
            setZipFiles={setZipFiles}
            selectedReview={selectedReview}
            setSelectedReview={setSelectedReview}
            fileResults={fileResults}
            setFileResults={setFileResults}
            codeProgress={codeProgress}
            setCodeProgress={setCodeProgress}
            isCodeProcessing={isCodeProcessing}
            setIsCodeProcessing={setIsCodeProcessing}
            selectedResult={selectedResult}
            setSelectedResult={setSelectedResult}
          />
        </div>
        <div className="mt-6">
          <SolidityAnalysisSection
            solidityConfig={solidityConfig}
            setSolidityConfig={setSolidityConfig}
            solidityResults={solidityResults}
            setSolidityResults={setSolidityResults}
            solidityProgress={solidityProgress}
            setSolidityProgress={setSolidityProgress}
            solidityStatus={solidityStatus}
            setSolidityStatus={setSolidityStatus}
            currentAnalysisStep={currentAnalysisStep}
            setCurrentAnalysisStep={setCurrentAnalysisStep}
            onComplete={handleComplete}
          />
        </div>

        {(Object.keys(networkResults).length > 0 || Object.keys(fileResults).length > 0) && (
          <SecurityReportExporter
            networkResults={networkResults}
            networkConfig={networkConfig}
            fileResults={fileResults}
            zipFiles={zipFiles}
            selectedReview={selectedReview}
          />
        )}
      </div>
    </div>
  )
}