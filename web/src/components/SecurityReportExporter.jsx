"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { marked } from "marked"
import { 
  Download, 
  FileText, 
  Shield, 
  Network, 
  Code2, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  BarChart3,
  PieChart,
  TrendingUp
} from "lucide-react"
import { PieChart as RechartsPieChart, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar } from "recharts"
import { Pie } from "react-chartjs-2"

export default function SecurityReportExporter({ 
  networkResults = {}, 
  networkConfig = {}, 
  fileResults = {}, 
  zipFiles = {}, 
  selectedReview = 'general' 
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)

  // Enhanced markdown parser to produce plain text
  const parseMarkdownToText = (input) => {
    if (!input) return ''
    
    try {
      // Convert input to string, handling objects and arrays
      let markdown = input
      if (typeof input === 'object') {
        if (Array.isArray(input)) {
          markdown = input.map(item => typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)).join('\n')
        } else {
          markdown = JSON.stringify(input, null, 2)
        }
      } else {
        markdown = String(input)
      }
      
      // Configure marked renderer for plain text output
      const renderer = new marked.Renderer()
      
      renderer.heading = (text, level) => `${'#'.repeat(level)} ${text}\n\n`
      renderer.paragraph = (text) => `${text}\n\n`
      renderer.strong = (text) => `${text}`
      renderer.em = (text) => `${text}`
      renderer.list = (body, ordered) => `${body}\n`
      renderer.listitem = (text) => `- ${text.replace(/\n/g, ' ').trim()}\n`
      renderer.code = (code, lang) => `\n${code}\n\n`
      renderer.codespan = (code) => `${code}`
      renderer.blockquote = (quote) => `> ${quote.trim()}\n\n`
      renderer.link = (href, title, text) => `${text} (${href})`
      renderer.image = (href, title, text) => `${text || 'Image'} (${href})`
      renderer.hr = () => '\n---\n\n'
      renderer.br = () => '\n'
      
      marked.setOptions({
        renderer: renderer,
        gfm: true,
        breaks: true,
        sanitize: true // Sanitize to remove HTML
      })
      
      // Parse markdown and clean up
      return marked.parse(markdown)
        .replace(/ /g, ' ')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/\[object Object\]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      
    } catch (error) {
      console.error('Error parsing markdown:', error)
      return String(input)
    }
  }

  // Generate PDF with professional formatting using plain text
  const generatePDF = async () => {
    setIsGenerating(true)
    setProgress(0)

    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = await import('html2canvas')
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      const margin = 15
      const maxWidth = pageWidth - (margin * 2)

      // Helper functions
      const checkPageBreak = (requiredSpace = 30) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage()
          yPosition = 20
          return true
        }
        return false
      }

      const addWrappedText = (text, x, y, maxWidth, lineHeight = 6, fontSize = 10) => {
        if (!text) return y
        
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', 'normal')
        const paragraphs = text.split('\n\n')
        let currentY = y
        
        paragraphs.forEach((paragraph, index) => {
          if (paragraph.trim()) {
            const estimatedLines = Math.ceil(paragraph.length / 80)
            checkPageBreak(estimatedLines * lineHeight + 5)
            
            const lines = doc.splitTextToSize(paragraph.trim(), maxWidth)
            doc.text(lines, x, currentY)
            currentY += (lines.length * lineHeight)
            
            if (index < paragraphs.length - 1) {
              currentY += lineHeight / 2
            }
            
            yPosition = currentY
          }
        })
        
        return currentY
      }

      const addSectionHeader = (title, level = 1) => {
        checkPageBreak(25)
        
        const fontSize = level === 1 ? 18 : 14
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', 'bold')
        
        yPosition += 10
        doc.text(title, margin, yPosition)
        yPosition += 8
        
        if (level === 1) {
          doc.setLineWidth(0.5)
          doc.setDrawColor(59, 130, 246) // shadcn primary blue
          doc.line(margin, yPosition, margin + 50, yPosition)
        }
        
        doc.setFont('helvetica', 'normal')
        doc.setDrawColor(0)
      }

      const addTableOfContents = (tocItems) => {
        doc.addPage()
        yPosition = 20
        addSectionHeader('Table of Contents')
        
        doc.setFontSize(10)
        tocItems.forEach((item, index) => {
          checkPageBreak(10)
          doc.text(item.title, margin, yPosition)
          doc.text(`Page ${item.page}`, pageWidth - margin - 10, yPosition, { align: 'right' })
          yPosition += 8
          if (index < tocItems.length - 1) {
            doc.setLineWidth(0.2)
            doc.setDrawColor(209, 213, 219) // shadcn gray-300
            doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
          }
        })
        yPosition += 10
      }

      const captureChart = async (elementId) => {
        const element = document.getElementById(elementId)
        if (element) {
          const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 2
          })
          return canvas.toDataURL('image/png')
        }
        return null
      }

      setProgress(10)

      // Track page numbers for table of contents
      let pageCounter = 1
      const tocItems = []

      // Title Page
      doc.setFillColor(59, 130, 246) // shadcn primary blue
      doc.rect(0, 0, pageWidth, 80, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.text('Security Assessment Report', pageWidth / 2, 40, { align: 'center' })
      
      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text('Comprehensive Network & Code Security Analysis', pageWidth / 2, 55, { align: 'center' })
      
      doc.setFontSize(10)
      const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      doc.text(`Generated on: ${currentDate}`, pageWidth / 2, 65, { align: 'center' })
      
      doc.setTextColor(0, 0, 0)
      pageCounter++

      // Table of Contents
      tocItems.push(
        { title: 'Executive Summary', page: pageCounter },
        { title: 'Network Security Analysis', page: pageCounter + 1 },
        { title: 'Source Code Security Review', page: pageCounter + 2 },
        { title: 'Security Recommendations', page: pageCounter + 3 }
      )
      addTableOfContents(tocItems)
      pageCounter++

      setProgress(20)

      // Executive Summary
      doc.addPage()
      yPosition = 20
      addSectionHeader('Executive Summary')
      
      const networkStats = getNetworkStats(networkResults)
      const codeStats = getCodeStats(fileResults)
      const securityScore = calculateSecurityScore()
      
      doc.setFillColor(securityScore >= 80 ? 34 : securityScore >= 60 ? 234 : 239, 
                      securityScore >= 80 ? 197 : securityScore >= 60 ? 179 : 68, 
                      securityScore >= 80 ? 94 : securityScore >= 60 ? 8 : 68) // shadcn green, yellow, red
      doc.circle(margin + 15, yPosition + 5, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(12)
      doc.text(securityScore.toString(), margin + 15, yPosition + 8, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`Overall Security Score: ${securityScore}/100`, margin + 30, yPosition + 8)
      yPosition += 25

      const summaryText = `
This comprehensive security assessment, conducted on ${currentDate}, provides a detailed analysis of network infrastructure and source code security.

Network Scan Results:
- Target System: ${networkConfig?.target || 'N/A'}
- Open Ports Discovered: ${networkStats.openPorts}
- SSL/TLS Security Issues: ${networkStats.sslIssues}
- HTTP Security Issues: ${networkStats.httpIssues}

Code Review Results:
- Total Files Analyzed: ${codeStats.totalFiles}
- Successfully Reviewed: ${codeStats.completedFiles}
- Review Failures: ${codeStats.errorFiles}
- Review Type: ${getReviewTypeLabel(selectedReview)}
- Success Rate: ${codeStats.totalFiles > 0 ? Math.round((codeStats.completedFiles / codeStats.totalFiles) * 100) : 0}%

Risk Assessment:
The overall security posture is rated as ${securityScore >= 80 ? 'EXCELLENT' : securityScore >= 60 ? 'SATISFACTORY' : 'NEEDS IMPROVEMENT'} based on identified vulnerabilities and code quality metrics.
`
      yPosition = addWrappedText(parseMarkdownToText(summaryText), margin, yPosition, maxWidth, 6)

      const securityChart = await captureChart('security-score-chart')
      if (securityChart) {
        checkPageBreak(60)
        doc.addImage(securityChart, 'PNG', margin, yPosition, maxWidth / 2, 50)
        yPosition += 60
      }
      pageCounter++

      setProgress(30)

      // Network Security Section
      if (networkResults && Object.keys(networkResults).length > 0 && networkResults.port_scan?.tcp) {
        doc.addPage()
        yPosition = 20
        addSectionHeader('Network Security Analysis')

        doc.setFillColor(243, 244, 246) // shadcn gray-100
        doc.rect(margin, yPosition, maxWidth, 30, 'F')
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Target Information', margin + 5, yPosition + 8)
        doc.setFont('helvetica', 'normal')
        doc.text(`Target: ${networkResults.target || 'N/A'}`, margin + 5, yPosition + 18)
        yPosition += 35

        const networkChart = await captureChart('network-issues-chart')
        if (networkChart) {
          checkPageBreak(60)
          doc.addImage(networkChart, 'PNG', margin, yPosition, maxWidth / 2, 50)
          yPosition += 60
        }

        if (networkResults.port_scan.tcp && Object.keys(networkResults.port_scan.tcp).length > 0) {
          addSectionHeader('Open Ports', 2)
          
          Object.entries(networkResults.port_scan.tcp).forEach(([port, info]) => {
            checkPageBreak(15)
            const service = info.name || 'Unknown'
            const version = info.version || ''
            
            doc.setFillColor(243, 244, 246) // shadcn gray-100
            doc.rect(margin, yPosition - 2, maxWidth, 10, 'F')
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text(`Port ${port}:`, margin + 5, yPosition + 6)
            doc.setFont('helvetica', 'normal')
            doc.text(`${service} ${version}`.trim(), margin + 40, yPosition + 6)
            yPosition += 12
          })
          yPosition += 10
        }

        setProgress(40)

        if (networkResults.ssl_security_findings && Object.keys(networkResults.ssl_security_findings).length > 0) {
          addSectionHeader('SSL/TLS Security', 2)
          
          Object.entries(networkResults.ssl_security_findings).forEach(([port, findings]) => {
            checkPageBreak(25)
            
            doc.setFillColor(254, 242, 242) // shadcn red-50
            doc.rect(margin, yPosition - 2, maxWidth, 12, 'F')
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text(`Port ${port} SSL Issues`, margin + 5, yPosition + 6)
            yPosition += 15
            
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            
            if (Array.isArray(findings.security_issues)) {
              findings.security_issues.forEach(issue => {
                checkPageBreak(10)
                yPosition = addWrappedText(`- ${parseMarkdownToText(issue)}`, margin + 10, yPosition, maxWidth - 15, 5)
                yPosition += 3
              })
            } else {
              yPosition = addWrappedText(`- ${parseMarkdownToText(findings)}`, margin + 10, yPosition, maxWidth - 15, 5)
            }
            yPosition += 10
          })
        }

        setProgress(50)

        if (networkResults.http_security_findings && Object.keys(networkResults.http_security_findings).length > 0) {
          addSectionHeader('HTTP Security', 2)
          
          Object.entries(networkResults.http_security_findings).forEach(([port, findings]) => {
            checkPageBreak(25)
            
            doc.setFillColor(254, 242, 242) // shadcn red-50
            doc.rect(margin, yPosition - 2, maxWidth, 12, 'F')
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text(`Port ${port} HTTP Issues`, margin + 5, yPosition + 6)
            yPosition += 15
            
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            
            if (Array.isArray(findings.security_issues)) {
              findings.security_issues.forEach(issue => {
                checkPageBreak(10)
                yPosition = addWrappedText(`- ${parseMarkdownToText(issue)}`, margin + 10, yPosition, maxWidth - 15, 5)
                yPosition += 3
              })
            } else {
              yPosition = addWrappedText(`- ${parseMarkdownToText(findings)}`, margin + 10, yPosition, maxWidth - 15, 5)
            }
            yPosition += 10
          })
        }
        pageCounter++
      }

      setProgress(60)

      // Code Review Section
      if (fileResults && Object.keys(fileResults).length > 0) {
        doc.addPage()
        yPosition = 20
        addSectionHeader('Source Code Security Review')

        doc.setFillColor(243, 244, 246) // shadcn gray-100
        doc.rect(margin, yPosition, maxWidth, 35, 'F')
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Review Configuration', margin + 5, yPosition + 8)
        doc.setFont('helvetica', 'normal')
        doc.text(`Review Type: ${getReviewTypeLabel(selectedReview)}`, margin + 5, yPosition + 18)
        doc.text(`Files Processed: ${codeStats.totalFiles} | Success: ${codeStats.completedFiles} | Errors: ${codeStats.errorFiles}`, margin + 5, yPosition + 28)
        yPosition += 45

        const codeChart = await captureChart('code-review-chart')
        if (codeChart) {
          checkPageBreak(60)
          doc.addImage(codeChart, 'PNG', margin, yPosition, maxWidth / 2, 50)
          yPosition += 60
        }

        setProgress(70)

        Object.entries(fileResults).forEach(([filename, result]) => {
          checkPageBreak(50)
          
          addSectionHeader(`File: ${filename}`, 2)
          
          const statusColor = result.status === 'completed' ? '#22c55e' : '#ef4444' // shadcn green/red
          doc.setFillColor(statusColor)
          doc.circle(margin + 10, yPosition + 2, 3, 'F')
          doc.setFontSize(12)
          doc.text(`Status: ${result.status.toUpperCase()}`, margin + 20, yPosition + 5)
          yPosition += 15

          if (result.status === 'completed' && result.result) {
            checkPageBreak(30)
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('Security Analysis Results:', margin, yPosition)
            yPosition += 10
            
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            yPosition = addWrappedText(parseMarkdownToText(result.result), margin, yPosition, maxWidth, 4)
            yPosition += 15
          } else if (result.status === 'error' && result.error) {
            checkPageBreak(20)
            doc.setFillColor(254, 242, 242) // shadcn red-50
            doc.rect(margin, yPosition - 2, maxWidth, 15, 'F')
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('Error Details:', margin + 5, yPosition + 6)
            yPosition += 18
            
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            yPosition = addWrappedText(parseMarkdownToText(result.error), margin, yPosition, maxWidth, 4)
            yPosition += 15
          }
          
          // Add source code if available
          if (zipFiles && typeof zipFiles === 'object' && zipFiles[filename]) {
            checkPageBreak(30)
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('Source Code:', margin, yPosition)
            yPosition += 10
            
            doc.setFont('courier', 'normal')
            doc.setFontSize(8)
            yPosition = addWrappedText(parseMarkdownToText(zipFiles[filename]), margin, yPosition, maxWidth, 4)
            yPosition += 15
            doc.setFont('helvetica', 'normal')
          }
          
          yPosition += 5
        })
        pageCounter++
      }

      setProgress(85)

      // Recommendations Section
      doc.addPage()
      yPosition = 20
      addSectionHeader('Security Recommendations')

      const recommendations = generateRecommendations(networkResults, fileResults)
      yPosition = addWrappedText(parseMarkdownToText(recommendations), margin, yPosition, maxWidth, 5)

      const overviewChart = await captureChart('security-overview-chart')
      if (overviewChart) {
        checkPageBreak(60)
        doc.addImage(overviewChart, 'PNG', margin, yPosition, maxWidth / 2, 50)
        yPosition += 60
      }
      pageCounter++

      setProgress(95)

      // Add page numbers and footer
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(107, 114, 128) // shadcn gray-500
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10)
        doc.text('Security Assessment Report', margin, pageHeight - 10)
        doc.text(`Generated: ${currentDate}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
      }

      setProgress(100)

      // Save PDF
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      doc.save(`security-report-${timestamp}.pdf`)
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    } finally {
      setIsGenerating(false)
      setProgress(0)
    }
  }

  // Helper functions
  const getNetworkStats = (results) => {
    if (!results) return { openPorts: 0, sslIssues: 0, httpIssues: 0 }
    
    const openPorts = results.port_scan?.tcp ? Object.keys(results.port_scan.tcp).length : 0
    const sslIssues = results.ssl_security_findings ? Object.keys(results.ssl_security_findings).length : 0
    const httpIssues = results.http_security_findings ? Object.keys(results.http_security_findings).length : 0
    
    return { openPorts, sslIssues, httpIssues }
  }

  const getCodeStats = (results) => {
    if (!results) return { totalFiles: 0, completedFiles: 0, errorFiles: 0 }
    
    const totalFiles = Object.keys(results).length
    const completedFiles = Object.values(results).filter(r => r.status === 'completed').length
    const errorFiles = Object.values(results).filter(r => r.status === 'error').length
    
    return { totalFiles, completedFiles, errorFiles }
  }

  const getReviewTypeLabel = (reviewType) => {
    const reviewTypes = {
      general: "General Review",
      security: "Security Audit",
      performance: "Performance Review",
      style: "Code Style Review",
      bugs: "Bug Detection",
      docs: "Documentation Review",
      config: "Configuration Review",
      "security-performance": "Security & Performance",
      upgrade: "Dependencies Review",
      tests: "Test Coverage",
      refactor: "Refactoring Suggestions",
      concurrency: "Concurrency Review"
    }
    return reviewTypes[reviewType] || reviewType
  }

  const calculateSecurityScore = () => {
    const networkStats = getNetworkStats(networkResults)
    const codeStats = getCodeStats(fileResults)
    
    let score = 100
    
    score -= networkStats.sslIssues * 15
    score -= networkStats.httpIssues * 10
    score -= Math.max(0, networkStats.openPorts - 3) * 5
    
    if (codeStats.totalFiles > 0) {
      const errorRate = codeStats.errorFiles / codeStats.totalFiles
      score -= errorRate * 25
    }
    
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  const generateRecommendations = (networkResults, fileResults) => {
    let recommendations = []

    recommendations.push("# Security Recommendations")

    if (networkResults && Object.keys(networkResults).length > 0) {
      if (networkResults.port_scan?.tcp && Object.keys(networkResults.port_scan.tcp).length > 0) {
        recommendations.push("## Network Security")
        recommendations.push("- Port Management: Review and close unnecessary open ports to reduce attack surface.")
        recommendations.push("- Firewall Configuration: Implement strict firewall rules to control traffic.")
        recommendations.push("- Service Hardening: Regularly audit and update running services.")
      }
      
      if (networkResults.ssl_security_findings && Object.keys(networkResults.ssl_security_findings).length > 0) {
        recommendations.push("## SSL/TLS Security")
        recommendations.push("- Cipher Suite Updates: Use only strong, modern cipher suites (e.g., TLS 1.3).")
        recommendations.push("- Certificate Management: Ensure certificates are valid and renewed timely.")
        recommendations.push("- Protocol Hardening: Disable outdated protocols (e.g., SSLv2, SSLv3, TLSv1.0/1.1).")
        recommendations.push("- Certificate Transparency: Implement monitoring for certificate transparency.")
      }
      
      if (networkResults.http_security_findings && Object.keys(networkResults.http_security_findings).length > 0) {
        recommendations.push("## HTTP Security")
        recommendations.push("- Security Headers: Implement Content Security Policy (CSP), HSTS, and X-Frame-Options.")
        recommendations.push("- Method Restrictions: Disable unnecessary HTTP methods (e.g., TRACE, OPTIONS).")
        recommendations.push("- Information Disclosure: Prevent server version leaks in HTTP responses.")
        recommendations.push("- Cookie Security: Use secure and HttpOnly cookie flags.")
      }
    }

    if (fileResults && Object.keys(fileResults).length > 0) {
      const stats = getCodeStats(fileResults)
      recommendations.push("## Code Security")
      if (stats.errorFiles > 0) {
        recommendations.push("- Error Resolution: Investigate and resolve code review errors.")
        recommendations.push("- Access Control: Verify file permissions and access controls.")
      }
      if (stats.completedFiles > 0) {
        recommendations.push("- Code Improvements: Apply recommended security enhancements.")
        recommendations.push("- Review Process: Implement regular automated code reviews.")
        recommendations.push("- CI/CD Integration: Incorporate security scanning in CI/CD pipelines.")
        recommendations.push("- Standards Documentation: Establish and enforce secure coding standards.")
      }
    }

    recommendations.push("## General Security Practices")
    recommendations.push("- Regular Assessments: Conduct quarterly security assessments.")
    recommendations.push("- Monitoring & Logging: Implement comprehensive security monitoring.")
    recommendations.push("- Team Training: Provide regular security awareness training.")
    recommendations.push("- Asset Management: Maintain an updated inventory of systems.")
    recommendations.push("- Incident Response: Develop and test incident response plans.")
    recommendations.push("- Vulnerability Management: Track and remediate vulnerabilities systematically.")

    return recommendations.join('\n')
  }

  // Chart data preparation
  const networkStats = getNetworkStats(networkResults)
  const codeStats = getCodeStats(fileResults)
  const securityScore = calculateSecurityScore()

  const chartData = {
    networkIssues: [
      { name: 'Open Ports', value: networkStats.openPorts, color: '#3b82f6' }, // shadcn blue
      { name: 'SSL Issues', value: networkStats.sslIssues, color: '#ef4444' }, // shadcn red
      { name: 'HTTP Issues', value: networkStats.httpIssues, color: '#f59e0b' } // shadcn yellow
    ],
    codeReview: [
      { name: 'Completed', value: codeStats.completedFiles, color: '#22c55e' }, // shadcn green
      { name: 'Errors', value: codeStats.errorFiles, color: '#ef4444' } // shadcn red
    ],
    securityTrend: [
      { category: 'Network', score: Math.max(0, 100 - (networkStats.sslIssues * 15 + networkStats.httpIssues * 10)) },
      { category: 'Code', score: codeStats.totalFiles > 0 ? Math.max(0, 100 - (codeStats.errorFiles / codeStats.totalFiles * 25)) : 100 },
      { category: 'Overall', score: securityScore }
    ]
  }

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'] // shadcn colors

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <span className="text-xl font-bold">Security Dashboard</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${
                    securityScore >= 80 ? 'bg-green-500' : 
                    securityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  } text-white`}>
                    Score: {securityScore}/100
                  </Badge>
                  <Badge variant="outline">
                    Enhanced Parsing
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-5 w-5 ${
                securityScore >= 80 ? 'text-green-500' : 
                securityScore >= 60 ? 'text-yellow-500' : 'text-red-500'
              }`} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Security Score Radial Chart */}
            <Card className="bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Security Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div id="security-score-chart" className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="80%" data={[{ name: 'Score', value: securityScore, fill: securityScore >= 80 ? '#22c55e' : securityScore >= 60 ? '#f59e0b' : '#ef4444' }]}>
                      <RadialBar dataKey="value" cornerRadius={10} />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-current">
                        {securityScore}
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Network Issues Chart */}
            <Card className="bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Network Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div id="network-issues-chart" className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={chartData.networkIssues}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      >
                        {chartData.networkIssues.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Code Review Chart */}
            <Card className="bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Code Review Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div id="code-review-chart" className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.codeReview}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value">
                        {chartData.codeReview.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Trend Chart */}
          <Card className="bg-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Security Assessment Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div id="security-overview-chart" className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.securityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                    <Legend />
                    <Bar 
                      dataKey="score" 
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Detailed Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-background border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Security Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{securityScore}/100</div>
            <div className="text-sm text-green-600">
              {securityScore >= 80 ? 'Excellent' : securityScore >= 60 ? 'Good' : 'Needs Improvement'}
            </div>
            <Progress value={securityScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-background border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-600" />
              Network Scan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Open Ports:</span>
                <Badge variant="outline">{networkStats.openPorts}</Badge>
              </div>
              <div className="flex justify-between">
                <span>SSL Issues:</span>
                <Badge variant={networkStats.sslIssues > 0 ? "destructive" : "secondary"}>
                  {networkStats.sslIssues}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>HTTP Issues:</span>
                <Badge variant={networkStats.httpIssues > 0 ? "destructive" : "secondary"}>
                  {networkStats.httpIssues}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Code2 className="h-4 w-4 text-purple-600" />
              Code Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Files:</span>
                <Badge variant="outline">{codeStats.totalFiles}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Completed:</span>
                <Badge className="bg-green-100 text-green-700">{codeStats.completedFiles}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Errors:</span>
                <Badge variant={codeStats.errorFiles > 0 ? "destructive" : "secondary"}>
                  {codeStats.errorFiles}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Risk Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                securityScore >= 80 ? 'text-green-600' :
                securityScore >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {securityScore >= 80 ? 'LOW' : securityScore >= 60 ? 'MEDIUM' : 'HIGH'}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Risk Assessment
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced PDF Export Section */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <span className="text-xl font-bold">Enhanced Security Report Export</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-primary/10 text-primary">
                    Plain Text Parsing
                  </Badge>
                  <Badge className="bg-green-100 text-green-700">
                    Visual Charts
                  </Badge>
                  <Badge className="bg-purple-100 text-purple-700">
                    Professional Layout
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {isGenerating && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Professional PDF Report...
                  </span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="text-xs text-muted-foreground">
                  {progress < 20 && "Initializing report generation..."}
                  {progress >= 20 && progress < 40 && "Processing network scan results..."}
                  {progress >= 40 && progress < 70 && "Analyzing code review data..."}
                  {progress >= 70 && progress < 90 && "Parsing plain text content..."}
                  {progress >= 90 && "Finalizing PDF document..."}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Report Features
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Plain text parsing from markdown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Professional formatting with visual elements</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Full content without truncation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Security scoring and risk assessment</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Report Sections
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Executive Summary with visual indicators</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    <span>Network security analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    <span>Complete code review results</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Comprehensive recommendations</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Enhanced report with charts, plain text parsing, and professional styling
              </div>
              <Button
                onClick={generatePDF}
                disabled={isGenerating || (Object.keys(networkResults || {}).length === 0 && Object.keys(fileResults || {}).length === 0)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90"
                size="lg"
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                {isGenerating ? "Generating..." : "Export Enhanced PDF Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}