import type { RegisterManager } from '@extension/registers/register-manager'

import { React19ShadcnPreset } from '.'
import { WebVMRegister } from '../../index'

export const runTestCase = async (registerManager: RegisterManager) => {
  const webvmRegister = registerManager.getRegister(WebVMRegister)!
  const projectId = 'test'
  const presetName = new React19ShadcnPreset().getPresetName()
  const orchestrator = await webvmRegister.addOrchestrator({
    projectId,
    presetName
  })
  orchestrator.startPreviewWithFiles([
    {
      relativePathOrSchemeUri: 'src/App.tsx',
      content: `import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Code, Zap, MessageSquare, Sparkles } from 'lucide-react'

export default function AIDELandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-6 px-4 md:px-6 lg:px-8">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">AIDE</h1>
          <Button variant="outline">Download</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 md:px-6 lg:px-8 py-12">
        <section className="text-center mb-12">
          <h2 className="text-4xl font-extrabold mb-4">Your AI Coding Assistant in VSCode</h2>
          <p className="text-xl mb-6">Boost your productivity with AIDE - the intelligent coding companion</p>
          <Button size="lg">Get Started</Button>
        </section>

        <Separator className="my-12" />

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Code className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Smart Code Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Get intelligent code suggestions as you type, powered by advanced AI models.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Zap className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Instant Code Refactoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Improve your code quality with AI-powered refactoring suggestions.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <MessageSquare className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Interactive Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Ask questions, get explanations, and receive coding guidance in natural language.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Sparkles className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Continuous Learning</CardTitle>
            </CardHeader>
            <CardContent>
              <p>AIDE adapts to your coding style and improves over time.</p>
            </CardContent>
          </Card>
        </section>

        <Separator className="my-12" />

        <section className="text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to supercharge your coding?</h2>
          <p className="text-xl mb-6">Join thousands of developers who are already using AIDE to write better code, faster.</p>
          <Button size="lg">Install AIDE for VSCode</Button>
        </section>
      </main>
      <footer className="py-6 px-4 md:px-6 lg:px-8 bg-muted">
        <div className="container mx-auto text-center">
          <p>&copy; 2025 AIDE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}`
    }
  ])
}
