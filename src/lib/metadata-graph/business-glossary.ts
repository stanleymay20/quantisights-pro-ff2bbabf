export interface BusinessTerm {
  id: string
  term: string
  definition: string
  synonyms: string[]
  linkedColumnIds: string[]
  linkedMetricIds: string[]
  owner?: string
  category: string
  createdAt: string
}

export interface BusinessGlossary {
  terms: BusinessTerm[]
  lastUpdated: string
}

class BusinessGlossaryStore {
  private terms: BusinessTerm[] = []

  addTerm(term: Omit<BusinessTerm, 'id' | 'createdAt'>): BusinessTerm {
    const newTerm: BusinessTerm = {
      ...term,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    this.terms.push(newTerm)
    return newTerm
  }

  getTerm(id: string): BusinessTerm | undefined {
    return this.terms.find(t => t.id === id)
  }

  findByName(name: string): BusinessTerm | undefined {
    const lower = name.toLowerCase()
    return this.terms.find(t => t.term.toLowerCase() === lower)
  }

  searchTerms(query: string): BusinessTerm[] {
    const lower = query.toLowerCase()
    return this.terms.filter(t =>
      t.term.toLowerCase().includes(lower) ||
      t.definition.toLowerCase().includes(lower) ||
      t.synonyms.some(s => s.toLowerCase().includes(lower))
    )
  }

  linkColumnToTerm(termId: string, columnId: string): void {
    const term = this.getTerm(termId)
    if (term && !term.linkedColumnIds.includes(columnId)) {
      term.linkedColumnIds.push(columnId)
    }
  }

  getTermsForColumn(columnId: string): BusinessTerm[] {
    return this.terms.filter(t => t.linkedColumnIds.includes(columnId))
  }

  getSnapshot(): BusinessGlossary {
    return { terms: [...this.terms], lastUpdated: new Date().toISOString() }
  }
}

export const businessGlossary = new BusinessGlossaryStore()
