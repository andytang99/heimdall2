import Store from '@/store/store';
import {Severity} from 'inspecjs';
import {parse} from 'search-query-parser';
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule
} from 'vuex-module-decorators';
import {ExtendedControlStatus} from './data_filters';

export interface ISearchState {
  searchTerm: string;
  freeSearch: string;
  titleSearchTerms: string[];
  descriptionSearchTerms: string[];
  controlIdSearchTerms: string[];
  codeSearchTerms: string[];
  ruleidSearchTerms: string[];
  vulidSearchTerms: string[];
  stigidSearchTerms: string[];
  classificationSearchTerms: string[];
  groupNameSearchTerms: string[];
  cciSearchTerms: string[];
  NISTIdFilter: string[];
  statusFilter: ExtendedControlStatus[];
  severityFilter: Severity[];
}

export interface SearchQuery {
  [key: string]: {
    include?: string;
    exclude?: string;
  };
}

export const statusTypes = [
  'Not Applicable',
  'From Profile',
  'Profile Error',
  'Passed',
  'Failed',
  'Not Reviewed',
  'Waived'
];

export const severityTypes = ['none', 'low', 'medium', 'high', 'critical'];

export function lowercaseAll(input: string | string[]): string | string[] {
  if (typeof input === 'string') {
    return input.toLowerCase();
  } else {
    return input.map((string) => {
      return string.toLowerCase();
    });
  }
}

export function valueToSeverity(severity: string): Severity {
  if (severityTypes.includes(severity.toLowerCase())) {
    return severity as Severity;
  } else {
    return 'none';
  }
}
@Module({
  namespaced: true,
  dynamic: true,
  store: Store,
  name: 'SearchModule'
})
class Search extends VuexModule implements ISearchState {
  controlIdSearchTerms: string[] = [];
  codeSearchTerms: string[] = [];
  ruleidSearchTerms: string[] = [];
  vulidSearchTerms: string[] = [];
  stigidSearchTerms: string[] = [];
  classificationSearchTerms: string[] = [];
  groupNameSearchTerms: string[] = [];
  cciSearchTerms: string[] = [];
  NISTIdFilter: string[] = [];
  descriptionSearchTerms: string[] = [];
  freeSearch = '';
  searchTerm = '';
  statusFilter: ExtendedControlStatus[] = [];
  severityFilter: Severity[] = [];
  titleSearchTerms: string[] = [];

  /** Update the current search */
  @Action
  updateSearch(newValue: string) {
    if (newValue) {
      this.context.commit('SET_SEARCH', newValue);
    } else {
      this.context.commit('SET_SEARCH', '');
    }
  }

  @Action
  parseSearch() {
    this.clear();
    const options = {
      keywords: [
        'status',
        'severity',
        'impact',
        'id',
        'title',
        'nist',
        'desc',
        'description',
        'code',
        'input',
        'ruleid',
        'vulid',
        'stigid',
        'classification',
        'groupname',
        'cci'
      ]
    };
    const searchResult = parse(this.searchTerm, options);
    if (typeof searchResult === 'string') {
      this.setFreesearch(searchResult);
    } else {
      for (const prop in searchResult) {
        const include: string | string[] = searchResult[prop] || '';
        switch (prop) {
          case 'status':
            this.addStatusFilter(
              include as ExtendedControlStatus | ExtendedControlStatus[]
            );
            break;
          case 'severity':
            this.addSeverityFilter(include as Severity | Severity[]);
            break;
          case 'id':
            this.addIdFilter(lowercaseAll(include));
            break;
          case 'title':
            this.addTitleFilter(lowercaseAll(include));
            break;
          case 'nist':
            this.addNISTIdFilter(lowercaseAll(include));
            break;
          case 'desc':
          case 'description':
            this.addDescriptionFilter(lowercaseAll(include));
            break;
          case 'code':
            this.addCodeFilter(lowercaseAll(include));
            break;
          case 'ruleid':
            this.addRuleidFilter(lowercaseAll(include));
            break;
          case 'vulid':
            this.addVulidFilter(lowercaseAll(include));
            break;
          case 'stigid':
            this.addStigidFilter(lowercaseAll(include));
            break;
          case 'classification':
            this.addClassificationFilter(lowercaseAll(include));
            break;
          case 'groupname':
            this.addGroupnameFilter(lowercaseAll(include));
            break;
          case 'cci':
            this.addCciFilter(lowercaseAll(include));
            break;
          case 'text':
            if (typeof include === 'string') {
              this.setFreesearch(include);
            }
            break;
        }
      }
    }
  }

  /** Sets the current search */
  @Mutation
  SET_SEARCH(newSearch: string) {
    this.searchTerm = newSearch;
  }

  /** Clears all current filters */
  @Action
  clear() {
    this.context.commit('CLEAR_SEVERITY');
    this.context.commit('CLEAR_STATUS');
    this.context.commit('CLEAR_ID');
    this.context.commit('CLEAR_TITLE');
    this.context.commit('CLEAR_NIST');
    this.context.commit('CLEAR_DESCRIPTION');
    this.context.commit('CLEAR_CODE');
    this.context.commit('CLEAR_RULEID');
    this.context.commit('CLEAR_FREESEARCH');
  }

  // Generic filtering
  @Action
  addSearchFilter(searchPayload: {
    field: string;
    value: string;
    previousValues: (string | ExtendedControlStatus)[];
  }) {
    // If we already have search filtering
    if (this.searchTerm.trim() !== '') {
      // If our current filters include the field
      if (
        this.searchTerm.toLowerCase().indexOf(`${searchPayload.field}:`) !== -1
      ) {
        const replaceRegex = new RegExp(`${searchPayload.field}:"(.*?)"`, 'gm');
        const newSearch = this.searchTerm.replace(
          replaceRegex,
          `${searchPayload.field}:"${searchPayload.previousValues
            .concat(searchPayload.value)
            .join(',')}"`
        );
        this.context.commit('SET_SEARCH', newSearch);
      } // We have a filter already, but it doesn't include the field
      else {
        const newSearch = `${this.searchTerm} ${
          searchPayload.field
        }:"${searchPayload.previousValues
          .concat(searchPayload.value)
          .join(',')}"`;
        this.context.commit('SET_SEARCH', newSearch);
      }
    }
    // We don't have any search yet
    else {
      this.context.commit(
        'SET_SEARCH',
        `${searchPayload.field}:"${searchPayload.value}"`
      );
    }
    this.parseSearch();
  }

  @Action
  removeSearchFilter(searchPayload: {
    field: string;
    value: string;
    previousValues: (string | ExtendedControlStatus)[];
  }) {
    searchPayload.previousValues = searchPayload.previousValues.filter(
      (filter) => filter.toLowerCase() !== searchPayload.value.toLowerCase()
    );
    const replaceRegex = new RegExp(`${searchPayload.field}:"(.*?)"`, 'gm');
    if (searchPayload.previousValues.length !== 0) {
      // If we still have any filters
      const newSearch = this.searchTerm.replace(
        replaceRegex,
        `${searchPayload.field}:"${searchPayload.previousValues.join(',')}"`
      );
      this.context.commit('SET_SEARCH', newSearch);
    } // Otherwise just remove the text from the search bar
    else {
      const newSearch = this.searchTerm.replace(replaceRegex, '');
      this.context.commit('SET_SEARCH', newSearch);
    }
    this.parseSearch();
  }

  // Status filtering

  @Action
  addStatusFilter(status: ExtendedControlStatus | ExtendedControlStatus[]) {
    this.context.commit('ADD_STATUS', status);
  }

  @Action
  removeStatusFilter(status: ExtendedControlStatus) {
    this.context.commit('REMOVE_STATUS', status);
  }

  @Action
  setStatusFilter(status: ExtendedControlStatus[]) {
    this.context.commit('SET_STATUS', status);
  }

  /** Adds a status filter */
  @Mutation
  ADD_STATUS(status: ExtendedControlStatus | ExtendedControlStatus[]) {
    this.statusFilter = this.statusFilter.concat(status);
  }

  /** Removes a status filter */
  @Mutation
  REMOVE_STATUS(status: ExtendedControlStatus) {
    this.statusFilter = this.statusFilter.filter(
      (filter) => filter.toLowerCase() !== status.toLowerCase()
    );
  }

  @Mutation
  CLEAR_STATUS() {
    this.statusFilter = [];
  }

  @Mutation
  SET_STATUS(status: ExtendedControlStatus[]) {
    this.statusFilter = status;
  }

  // Severity filtering

  /** Adds severity to filter */
  @Action
  addSeverityFilter(severity: Severity | Severity[]) {
    this.context.commit('ADD_SEVERITY', severity);
  }

  @Action
  removeSeverity(severity: Severity) {
    this.context.commit('REMOVE_SEVERITY', severity);
  }

  @Action
  setSeverity(severity: Severity[]) {
    this.context.commit('SET_SEVERITY', severity);
  }

  @Action
  clearSeverityFilter() {
    this.context.commit('CLEAR_SEVERITY');
  }

  @Mutation
  ADD_SEVERITY(severity: Severity | Severity[]) {
    this.severityFilter = this.severityFilter.concat(severity);
  }

  @Mutation
  REMOVE_SEVERITY(severity: Severity) {
    this.severityFilter = this.severityFilter.filter(
      (filter) => filter.toLowerCase() !== severity.toLowerCase()
    );
  }

  /** Sets the severity filter */
  @Mutation
  SET_SEVERITY(severity: Severity[]) {
    this.severityFilter = severity;
  }

  /** Clears all severity filters */
  @Mutation
  CLEAR_SEVERITY() {
    this.severityFilter = [];
  }

  // Control ID Filtering

  /** Adds control id to filter */
  @Action
  addIdFilter(id: string | string[]) {
    this.context.commit('ADD_ID', id);
  }

  @Mutation
  ADD_ID(id: string | string[]) {
    this.controlIdSearchTerms = this.controlIdSearchTerms.concat(id);
  }

  /** Sets the control IDs filter */
  @Mutation
  SET_ID(ids: string[]) {
    this.controlIdSearchTerms = ids;
  }

  /** Clears all control ID filters */
  @Mutation
  CLEAR_ID() {
    this.controlIdSearchTerms = [];
  }

  // Title filtering

  /** Adds a title filter */
  @Action
  addTitleFilter(title: string | string[]) {
    this.context.commit('ADD_TITLE', title);
  }

  @Mutation
  ADD_TITLE(title: string | string[]) {
    this.titleSearchTerms = this.titleSearchTerms.concat(title);
  }

  /** Sets the title filters */
  @Mutation
  SET_TITLE(titles: string[]) {
    this.titleSearchTerms = titles;
  }

  /** Clears all title filters */
  @Mutation
  CLEAR_TITLE() {
    this.titleSearchTerms = [];
  }

  // NIST ID Filtering

  /** Adds NIST ID to filter */
  @Action
  addNISTIdFilter(NISTId: string | string[]) {
    this.context.commit('ADD_NIST', NISTId);
  }

  @Mutation
  ADD_NIST(NISTId: string | string[]) {
    this.NISTIdFilter = this.NISTIdFilter.concat(NISTId);
  }

  /** Clears all NIST ID filters */
  @Mutation
  CLEAR_NIST() {
    this.NISTIdFilter = [];
  }

  // Description Filtering

  /** Calls the description mutator to add a description to the filter */
  @Action
  addDescriptionFilter(description: string | string[]) {
    this.context.commit('ADD_DESCRIPTION', description);
  }

  /** Adds a description to the filter */
  @Mutation
  ADD_DESCRIPTION(description: string | string[]) {
    this.descriptionSearchTerms =
      this.descriptionSearchTerms.concat(description);
  }

  /** Clears all description from the filters */
  @Mutation
  CLEAR_DESCRIPTION() {
    this.descriptionSearchTerms = [];
  }

  // Code filtering

  /** Adds code to filter */
  @Action
  addCodeFilter(code: string | string[]) {
    this.context.commit('ADD_CODE', code);
  }

  @Mutation
  ADD_CODE(code: string | string[]) {
    this.codeSearchTerms = this.codeSearchTerms.concat(code);
  }

  /** Clears all code filters */
  @Mutation
  CLEAR_CODE() {
    this.codeSearchTerms = [];
  }

  // Ruleid filtering

  /** Adds Ruleid to filter */
  @Action
  addRuleidFilter(ruleid: string | string[]) {
    this.context.commit('ADD_RULEID', ruleid);
  }

  @Mutation
  ADD_RULEID(ruleid: string | string[]) {
    this.ruleidSearchTerms = this.ruleidSearchTerms.concat(ruleid);
  }

  /** Clears all Ruleid filters */
  @Mutation
  CLEAR_RULEID() {
    this.ruleidSearchTerms = [];
  }

  // Vulid filtering

  /** Adds Vulid to filter */
  @Action
  addVulidFilter(vulid: string | string[]) {
    this.context.commit('ADD_VULID', vulid);
  }

  @Mutation
  ADD_VULID(vulid: string | string[]) {
    this.vulidSearchTerms = this.vulidSearchTerms.concat(vulid);
  }

  /** Clears all Vulid filters */
  @Mutation
  CLEAR_VULID() {
    this.vulidSearchTerms = [];
  }

  // Stigid filtering

  /** Adds Stigid to filter */
  @Action
  addStigidFilter(stigid: string | string[]) {
    this.context.commit('ADD_STIGID', stigid);
  }

  @Mutation
  ADD_STIGID(stigid: string | string[]) {
    this.stigidSearchTerms = this.stigidSearchTerms.concat(stigid);
  }

  /** Clears all Stigid filters */
  @Mutation
  CLEAR_STIGID() {
    this.stigidSearchTerms = [];
  }

  // Classification filtering

  /** Adds Classification to filter */
  @Action
  addClassificationFilter(classification: string | string[]) {
    this.context.commit('ADD_CLASSIFICATION', classification);
  }

  @Mutation
  ADD_CLASSIFICATION(classification: string | string[]) {
    this.classificationSearchTerms =
      this.classificationSearchTerms.concat(classification);
  }

  /** Clears all Classification filters */
  @Mutation
  CLEAR_CLASSIFICATION() {
    this.classificationSearchTerms = [];
  }

  // Groupname filtering

  /** Adds Groupname to filter */
  @Action
  addGroupnameFilter(groupname: string | string[]) {
    this.context.commit('ADD_GROUPNAME', groupname);
  }

  @Mutation
  ADD_GROUPNAME(groupname: string | string[]) {
    this.groupNameSearchTerms = this.groupNameSearchTerms.concat(groupname);
  }

  /** Clears all Groupname filters */
  @Mutation
  CLEAR_GROUPNAME() {
    this.groupNameSearchTerms = [];
  }

  // CCI filtering

  /** Adds CCI to filter */
  @Action
  addCciFilter(cci: string | string[]) {
    this.context.commit('ADD_CCI', cci);
  }

  @Mutation
  ADD_CCI(cci: string | string[]) {
    this.cciSearchTerms = this.cciSearchTerms.concat(cci);
  }

  /** Clears all CCI filters */
  @Mutation
  CLEAR_CCI() {
    this.cciSearchTerms = [];
  }

  // Freetext search

  /** Sets the current fulltext search */
  @Action
  setFreesearch(search: string) {
    this.context.commit('SET_FREESEARCH', search);
  }

  @Mutation
  SET_FREESEARCH(text: string) {
    this.freeSearch = text;
  }

  /** Removes the current fulltext search */
  @Mutation
  CLEAR_FREESEARCH() {
    this.freeSearch = '';
  }
}

export const SearchModule = getModule(Search);
