import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const emptyEducation = { schoolName: '', degree: '', graduationYear: '' }
const emptyExperience = {
  jobTitle: '',
  company: '',
  startDate: '',
  endDate: '',
  responsibilities: '',
}

const inputClassName =
  'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

async function postToApi(endpoint, body) {
  const response = await fetch(`${apiBaseUrl}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let result
  try {
    result = JSON.parse(await response.text())
  } catch {
    throw new Error(
      'AI request reached a non-API page. Set VITE_API_BASE_URL to your Render backend Web Service URL (not the Static Site URL), then rebuild and redeploy the Static Site.',
    )
  }
  if (!response.ok) {
    throw new Error(result.error || `AI service request failed (${response.status}).`)
  }
  return result
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className={inputClassName}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  )
}

function SectionHeading({ number, title, description }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
        {number}
      </span>
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function App() {
  const [resumeData, setResumeData] = useState({
    personalInfo: { name: '', email: '', phone: '' },
    education: [{ ...emptyEducation }],
    experience: [{ ...emptyExperience }],
  })
  const [skills, setSkills] = useState([])
  const [skillInput, setSkillInput] = useState('')
  const [suggestedSkills, setSuggestedSkills] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState('')
  const [summaryInput, setSummaryInput] = useState('')
  const [resumeSummary, setResumeSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [pdfExportError, setPdfExportError] = useState('')
  const [pdfExportStatus, setPdfExportStatus] = useState('')

  const updatePersonalInfo = (field, value) => {
    setResumeData((current) => ({
      ...current,
      personalInfo: { ...current.personalInfo, [field]: value },
    }))
  }

  const updateEntry = (section, index, field, value) => {
    setResumeData((current) => ({
      ...current,
      [section]: current[section].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    }))
  }

  const addEntry = (section, emptyEntry) => {
    setResumeData((current) => ({
      ...current,
      [section]: [...current[section], { ...emptyEntry }],
    }))
  }

  const removeEntry = (section, index) => {
    setResumeData((current) => ({
      ...current,
      [section]: current[section].filter((_, entryIndex) => entryIndex !== index),
    }))
  }

  const addSkill = (skill) => {
    const trimmedSkill = skill.trim()
    if (
      trimmedSkill &&
      !skills.some((existingSkill) => existingSkill.toLowerCase() === trimmedSkill.toLowerCase())
    ) {
      setSkills((current) => [...current, trimmedSkill])
    }
    setSkillInput('')
  }

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true)
    setSuggestionsError('')
    try {
      const { skills: suggestions } = await postToApi('skills', {})
      if (!Array.isArray(suggestions) || suggestions.some((skill) => typeof skill !== 'string')) {
        throw new Error('AI service returned an unexpected skills response.')
      }
      setSuggestedSkills(suggestions.map((skill) => skill.trim()).filter(Boolean).slice(0, 10))
    } catch (error) {
      setSuggestionsError(
        error instanceof Error ? error.message : 'Unable to load skill suggestions.',
      )
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const generateSummary = async () => {
    const background = summaryInput.trim()
    if (!background) {
      setSummaryError('Enter a few keywords or details about your professional background first.')
      return
    }

    setSummaryLoading(true)
    setSummaryError('')
    try {
      const { summary } = await postToApi('summary', { background })
      if (typeof summary !== 'string' || !summary.trim()) {
        throw new Error('Gemini returned no summary. Please try again.')
      }
      setResumeSummary(summary.trim())
    } catch (error) {
      setSummaryError(
        error instanceof Error ? error.message : 'Unable to generate a professional summary.',
      )
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleExportPDF = async () => {
    setPdfExportError('')
    setPdfExportStatus('')
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 48
      const cursor = { y: 58 }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(24)
      const nameLines = doc.splitTextToSize(displayName, pageWidth - margin * 2)
      doc.text(nameLines, margin, cursor.y)
      cursor.y += nameLines.length * 28

      const contactDetails = [personalInfo.email, personalInfo.phone].filter(Boolean).join('  |  ')
      if (contactDetails) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const contactLines = doc.splitTextToSize(contactDetails, pageWidth - margin * 2)
        doc.text(contactLines, margin, cursor.y)
        cursor.y += contactLines.length * 14 + 10
      }

      const addSectionHeading = (title) => {
        if (cursor.y > pageHeight - margin - 24) {
          doc.addPage()
          cursor.y = margin
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(title.toUpperCase(), margin, cursor.y)
        cursor.y += 8
        doc.setDrawColor(79, 70, 229)
        doc.line(margin, cursor.y, pageWidth - margin, cursor.y)
        cursor.y += 16
      }

      addSectionHeading('Summary')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const summaryLines = doc.splitTextToSize(
        resumeSummary || 'No professional summary added.',
        pageWidth - margin * 2,
      )
      summaryLines.forEach((line) => {
        if (cursor.y > pageHeight - margin) {
          doc.addPage()
          cursor.y = margin
        }
        doc.text(line, margin, cursor.y)
        cursor.y += 14
      })
      cursor.y += 8

      const experienceItems = experience.filter(
        (item) => item.jobTitle || item.company || item.responsibilities,
      )
      addSectionHeading('Experience')
      autoTable(doc, {
        startY: cursor.y,
        head: [['Job title and company', 'Dates', 'Responsibilities']],
        body:
          experienceItems.length > 0
            ? experienceItems.map((item) => [
                [item.jobTitle, item.company].filter(Boolean).join('\n') || '—',
                [item.startDate, item.endDate].filter(Boolean).join(' – ') || '—',
                item.responsibilities || '—',
              ])
            : [['No experience added.', '', '']],
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, overflow: 'linebreak' },
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 95 } },
      })
      cursor.y = doc.lastAutoTable.finalY + 18

      addSectionHeading('Education')
      const educationItems = education.filter(
        (item) => item.schoolName || item.degree || item.graduationYear,
      )
      autoTable(doc, {
        startY: cursor.y,
        head: [['School or institution', 'Degree', 'Graduation year']],
        body:
          educationItems.length > 0
            ? educationItems.map((item) => [
                item.schoolName || '—',
                item.degree || '—',
                item.graduationYear || '—',
              ])
            : [['No education added.', '', '']],
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, overflow: 'linebreak' },
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: { 2: { cellWidth: 90 } },
      })
      cursor.y = doc.lastAutoTable.finalY + 18

      addSectionHeading('Skills')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const skillLines = doc.splitTextToSize(
        skills.length > 0 ? skills.join('  ·  ') : 'No skills added.',
        pageWidth - margin * 2,
      )
      skillLines.forEach((line) => {
        if (cursor.y > pageHeight - margin) {
          doc.addPage()
          cursor.y = margin
        }
        doc.text(line, margin, cursor.y)
        cursor.y += 14
      })

      const filename =
        `${personalInfo.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'resume'}.pdf`
      doc.save(filename)
      setPdfExportStatus('PDF download started.')
    } catch (error) {
      setPdfExportStatus('')
      setPdfExportError(
        error instanceof Error ? error.message : 'Unable to export the resume as a PDF.',
      )
    }
  }

  useEffect(() => {
    void Promise.resolve().then(fetchSuggestions)
  }, [])

  const { personalInfo, education, experience } = resumeData
  const displayName = personalInfo.name.trim() || 'Your Name'

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 font-semibold tracking-tight text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">
              R
            </span>
            <span>resume<span className="text-indigo-600">craft</span></span>
          </a>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
            Resume builder
          </span>
        </header>

        <section className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Make your next move
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Build a resume that <span className="text-indigo-600">opens doors.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
            Add your details and watch your professional story take shape in real time.
          </p>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading
                number="01"
                title="Personal information"
                description="How employers can get in touch with you."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Full name"
                    value={personalInfo.name}
                    onChange={(event) => updatePersonalInfo('name', event.target.value)}
                    placeholder="e.g. Alex Morgan"
                  />
                </div>
                <Field
                  label="Email address"
                  type="email"
                  value={personalInfo.email}
                  onChange={(event) => updatePersonalInfo('email', event.target.value)}
                  placeholder="alex@example.com"
                />
                <Field
                  label="Phone number"
                  type="tel"
                  value={personalInfo.phone}
                  onChange={(event) => updatePersonalInfo('phone', event.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <SectionHeading
                  number="02"
                  title="Education"
                  description="Add schools, degrees, or certifications."
                />
                <button
                  type="button"
                  onClick={() => addEntry('education', emptyEducation)}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-4">
                {education.map((entry, index) => (
                  <div key={index} className="rounded-xl bg-slate-50 p-4">
                    {education.length > 1 && (
                      <div className="mb-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeEntry('education', index)}
                          className="text-xs font-semibold text-slate-400 transition hover:text-rose-600"
                          aria-label={`Remove education entry ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field
                          label="School or institution"
                          value={entry.schoolName}
                          onChange={(event) =>
                            updateEntry('education', index, 'schoolName', event.target.value)
                          }
                          placeholder="e.g. State University"
                        />
                      </div>
                      <Field
                        label="Degree"
                        value={entry.degree}
                        onChange={(event) =>
                          updateEntry('education', index, 'degree', event.target.value)
                        }
                        placeholder="e.g. B.S. Computer Science"
                      />
                      <Field
                        label="Graduation year"
                        value={entry.graduationYear}
                        onChange={(event) =>
                          updateEntry('education', index, 'graduationYear', event.target.value)
                        }
                        placeholder="e.g. 2024"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <SectionHeading
                  number="03"
                  title="Experience"
                  description="Showcase the work you’re proud of."
                />
                <button
                  type="button"
                  onClick={() => addEntry('experience', emptyExperience)}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-4">
                {experience.map((entry, index) => (
                  <div key={index} className="rounded-xl bg-slate-50 p-4">
                    {experience.length > 1 && (
                      <div className="mb-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeEntry('experience', index)}
                          className="text-xs font-semibold text-slate-400 transition hover:text-rose-600"
                          aria-label={`Remove experience entry ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Job title"
                        value={entry.jobTitle}
                        onChange={(event) =>
                          updateEntry('experience', index, 'jobTitle', event.target.value)
                        }
                        placeholder="e.g. Frontend Developer"
                      />
                      <Field
                        label="Company"
                        value={entry.company}
                        onChange={(event) =>
                          updateEntry('experience', index, 'company', event.target.value)
                        }
                        placeholder="e.g. Acme Studio"
                      />
                      <Field
                        label="Start date"
                        type="month"
                        value={entry.startDate}
                        onChange={(event) =>
                          updateEntry('experience', index, 'startDate', event.target.value)
                        }
                      />
                      <Field
                        label="End date"
                        type="month"
                        value={entry.endDate}
                        onChange={(event) =>
                          updateEntry('experience', index, 'endDate', event.target.value)
                        }
                      />
                      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                        Responsibilities or achievements
                        <textarea
                          className={`${inputClassName} min-h-24 resize-y`}
                          value={entry.responsibilities}
                          onChange={(event) =>
                            updateEntry(
                              'experience',
                              index,
                              'responsibilities',
                              event.target.value,
                            )
                          }
                          placeholder="Describe your impact, projects, or key responsibilities."
                          rows={3}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading
                number="04"
                title="Professional summary"
                description="Share a few keywords to generate a polished introduction."
              />
              <label className="block text-sm font-medium text-slate-700">
                Keywords or professional background
                <textarea
                  className={`${inputClassName} min-h-28 resize-y`}
                  value={summaryInput}
                  onChange={(event) => setSummaryInput(event.target.value)}
                  placeholder="e.g. Frontend developer, 5 years of experience, React, accessible interfaces, mentoring"
                  rows={4}
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={generateSummary}
                  disabled={summaryLoading}
                  className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-wait disabled:opacity-60"
                >
                  {summaryLoading ? 'Generating…' : 'Generate Summary'}
                </button>
                {summaryError && (
                  <p className="text-sm text-amber-700" role="alert">
                    {summaryError}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading
                number="05"
                title="Skills"
                description="Add strengths that make you stand out."
              />
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  addSkill(skillInput)
                }}
              >
                <input
                  className={`${inputClassName} mt-0 min-w-0 flex-1`}
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  placeholder="e.g. React, communication"
                  aria-label="Add a skill"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                >
                  Add skill
                </button>
              </form>

              {skills.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Added skills">
                  {skills.map((skill, index) => (
                    <li
                      key={`${skill}-${index}`}
                      className="flex items-center gap-2 rounded-full bg-indigo-50 py-1.5 pl-3 pr-2 text-sm font-medium text-indigo-700"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => setSkills((current) => current.filter((_, i) => i !== index))}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700"
                        aria-label={`Remove ${skill}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    AI suggestions
                  </p>
                  {suggestionsError && (
                    <button
                      type="button"
                      onClick={fetchSuggestions}
                      disabled={suggestionsLoading}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                      Try again
                    </button>
                  )}
                </div>
                {suggestionsLoading && (
                  <p className="text-sm text-slate-500" role="status">
                    Finding skills for your resume…
                  </p>
                )}
                {suggestionsError && (
                  <p className="text-sm text-amber-700" role="alert">
                    {suggestionsError}
                  </p>
                )}
                {!suggestionsLoading && !suggestionsError && suggestedSkills.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {suggestedSkills.map((skill) => (
                      <li key={skill}>
                        <button
                          type="button"
                          onClick={() => addSkill(skill)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          + {skill}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-slate-700">Live preview</h2>
              <button
                type="button"
                onClick={handleExportPDF}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
              >
                Export to PDF
              </button>
            </div>
            {pdfExportError && (
              <p className="mb-3 text-sm text-rose-700" role="alert">
                {pdfExportError}
              </p>
            )}
            {pdfExportStatus && (
              <p className="mb-3 text-sm text-emerald-700" role="status">
                {pdfExportStatus}
              </p>
            )}
            <article className="min-h-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              <div className="h-2 bg-indigo-600" />
              <div className="p-7 sm:p-9">
                <h2 className="break-words text-3xl font-bold tracking-tight text-slate-900">
                  {displayName}
                </h2>
                {(personalInfo.email || personalInfo.phone) && (
                  <p className="mt-2 break-all text-sm text-slate-500">
                    {[personalInfo.email, personalInfo.phone].filter(Boolean).join('  ·  ')}
                  </p>
                )}

                <section className="mt-9">
                  <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                    Summary
                  </h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {resumeSummary || 'Your professional summary will appear here.'}
                  </p>
                </section>

                <section className="mt-9">
                  <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                    Experience
                  </h3>
                  <div className="space-y-5 pt-4">
                    {experience.filter(
                      (item) => item.jobTitle || item.company || item.responsibilities,
                    ).length > 0 ? (
                      experience
                        .filter(
                          (item) => item.jobTitle || item.company || item.responsibilities,
                        )
                        .map((item, index) => (
                          <div key={index}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <p className="font-semibold text-slate-800">
                                {[item.jobTitle, item.company].filter(Boolean).join(' · ') ||
                                  'Experience'}
                              </p>
                              {(item.startDate || item.endDate) && (
                                <span className="text-xs text-slate-400">
                                  {[item.startDate, item.endDate].filter(Boolean).join(' – ')}
                                </span>
                              )}
                            </div>
                            {item.responsibilities && (
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-slate-600">
                                {item.responsibilities
                                  .split('\n')
                                  .map((responsibility) => responsibility.trim())
                                  .filter(Boolean)
                                  .map((responsibility, responsibilityIndex) => (
                                    <li key={responsibilityIndex}>{responsibility}</li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        ))
                    ) : (
                      <p className="text-sm italic text-slate-400">
                        Your experience will appear here.
                      </p>
                    )}
                  </div>
                </section>

                <section className="mt-8">
                  <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                    Education
                  </h3>
                  <div className="space-y-4 pt-4">
                    {education.filter((item) => item.schoolName || item.degree).length > 0 ? (
                      education
                        .filter((item) => item.schoolName || item.degree)
                        .map((item, index) => (
                          <div key={index}>
                            <p className="font-semibold text-slate-800">
                              {item.degree || 'Degree'}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {[item.schoolName, item.graduationYear].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm italic text-slate-400">
                        Your education will appear here.
                      </p>
                    )}
                  </div>
                </section>

                <section className="mt-8">
                  <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                    Skills
                  </h3>
                  {skills.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {skills.map((skill, index) => (
                        <li
                          key={`${skill}-${index}`}
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        >
                          {skill}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm italic text-slate-400">
                      Your skills will appear here.
                    </p>
                  )}
                </section>
              </div>
            </article>
          </aside>
        </div>
        <footer className="py-8 text-center text-xs text-slate-400">
          Your details stay in this browser session.
        </footer>
      </div>
    </main>
  )
}

export default App
