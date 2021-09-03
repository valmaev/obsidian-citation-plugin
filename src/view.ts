import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import * as _ from 'lodash';

import type CitationPlugin from './main';
import type { Entry } from './types';
import Citations from './ui/Citations.svelte';

export class CitationsView extends ItemView {
  private plugin: CitationPlugin;

  private view: Citations;

  constructor(leaf: WorkspaceLeaf, plugin: CitationPlugin) {
    super(leaf);

    this.plugin = plugin;
  }

  load() {
    this.registerEvent(
      this.app.workspace.on('file-open', this.onFileOpen, this),
    );
    this.registerEvent(
      this.app.workspace.on('codemirror', this.onCodeMirror, this),
    );

    this.registerEvent(
      this.plugin.events.on('library-load-complete', () => this.redraw()),
    );

    console.log('citation view loaded');
  }

  async onOpen() {
    this.view = new Citations({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: (this as any).contentEl,
      props: {
        citations: [],
      },
    });

    this.redraw();
  }

  async getCitations(content: string): Promise<[Entry, string, string[]][]> {
    const results = this.plugin
      .extractCitations(content)
      .filter(([entry]) => !!entry);
    const groupedResults = _.groupBy(results, ([entry]) => entry.id);
    const uniqueIds = Object.keys(groupedResults);

    // Render bibliography strings with citation service.
    const [, bibStrings] = this.plugin.citationService.renderBibliography(
      uniqueIds,
    );
    const bibStringMap = Object.fromEntries(_.zip(uniqueIds, bibStrings));

    return Object.values(groupedResults).map((occurrences) => {
      const entry = occurrences[0][0];
      const bibString = bibStringMap[entry.id];
      const occurrenceStrings = occurrences.map(([, line]) => line);
      return [entry, bibString, occurrenceStrings];
    });
  }

  async redraw(): Promise<void> {
    if (this.view) {
      if (this.plugin.isLibraryLoading) {
        this.view.$set({ citations: null, loading: true });
      } else {
        const activeLeaf: any = this.app.workspace.activeLeaf ?? null;
        const data: string = activeLeaf?.view?.data;
        if (data == null) return;

        const citations = await this.getCitations(data);
        this.view.$set({ citations, loading: false });
      }
    }
  }

  getViewType(): string {
    return 'citations';
  }

  getDisplayText(): string {
    return 'Citations';
  }

  onFileOpen(file: TFile) {
    this.redraw();
  }

  onCodeMirror(cm: CodeMirror.Editor) {
    cm.on('change', this.redraw);
  }
}