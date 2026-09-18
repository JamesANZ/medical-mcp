import {
  extractArticlePmcId,
  parsePubMedXML,
  pmcRecordMatchesArticle,
} from "../pubmed-xml.js";
import {
  organizationFilterMatches,
  extractOrganizationName,
} from "../organization.js";
import { isAllowedAapUrl, classifyAapResult } from "../aap-urls.js";
import {
  decodeHtmlEntities,
  isValidPmid,
  quoteMultiWordQuery,
  sameGuideline,
} from "../text.js";
import {
  mapWhoDataValue,
  sortWhoValues,
  latestWhoSnapshot,
} from "../who-gho.js";
import { classifyEvidence } from "../evidence-grading.js";

const TIGHTEN_XML = `
<PubmedArticle>
  <MedlineCitation>
    <PMID>42742671</PMID>
    <Article>
      <Journal>
        <Title>Diabetes Therapy</Title>
        <JournalIssue>
          <PubDate>
            <Year>2026</Year>
            <Month>Mar</Month>
          </PubDate>
        </JournalIssue>
      </Journal>
      <ArticleTitle>TIGHTEN protocol for tofogliflozin &amp; G&#xf6;kp&#x131;nar</ArticleTitle>
      <Abstract>
        <AbstractText>Study protocol for TIGHTEN.</AbstractText>
      </Abstract>
      <AuthorList>
        <Author>
          <LastName>Kumashiro</LastName>
          <ForeName>Naoki</ForeName>
        </Author>
      </AuthorList>
      <ELocationID EIdType="doi">10.1007/s13300-026-01920-1</ELocationID>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <ArticleIdList>
      <ArticleId IdType="pubmed">42742671</ArticleId>
      <ArticleId IdType="doi">10.1007/s13300-026-01920-1</ArticleId>
    </ArticleIdList>
    <ReferenceList>
      <Reference>
        <Citation>DIVERSITY-CVR</Citation>
        <ArticleIdList>
          <ArticleId IdType="pubmed">31898479</ArticleId>
          <ArticleId IdType="pmc">PMC6945792</ArticleId>
        </ArticleIdList>
      </Reference>
    </ReferenceList>
  </PubmedData>
</PubmedArticle>
`;

const WITH_OWN_PMC = `
<PubmedArticle>
  <MedlineCitation>
    <PMID>111</PMID>
    <Article>
      <Journal><Title>Pediatrics</Title></Journal>
      <ArticleTitle>Has its own PMC</ArticleTitle>
      <AuthorList></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <ArticleIdList>
      <ArticleId IdType="pubmed">111</ArticleId>
      <ArticleId IdType="pmc">PMC13565910</ArticleId>
    </ArticleIdList>
    <ReferenceList>
      <Reference>
        <ArticleIdList>
          <ArticleId IdType="pmc">PMC8625287</ArticleId>
        </ArticleIdList>
      </Reference>
    </ReferenceList>
  </PubmedData>
</PubmedArticle>
`;

describe("PubMed XML PMC IDs", () => {
  test("does not take PMC IDs from cited papers in ReferenceList", () => {
    expect(extractArticlePmcId(TIGHTEN_XML)).toBeUndefined();
    const [article] = parsePubMedXML(TIGHTEN_XML);
    expect(article.pmid).toBe("42742671");
    expect(article.pmc_id).toBeUndefined();
    expect(article.title).toContain("TIGHTEN");
    expect(article.title).toContain("Gökpınar");
    expect(article.authors).toEqual(["Naoki Kumashiro"]);
  });

  test("keeps the article's own PMC ID from PubmedData ArticleIdList", () => {
    const [article] = parsePubMedXML(WITH_OWN_PMC);
    expect(article.pmc_id).toBe("13565910");
  });

  test("rejects a PMC record whose PMID does not match", () => {
    const pmcXml = `
      <article>
        <article-id pub-id-type="pmid">31898479</article-id>
        <article-id pub-id-type="doi">10.1186/s12933-019-0977-z</article-id>
      </article>
    `;
    expect(
      pmcRecordMatchesArticle(pmcXml, {
        pmid: "42742671",
        doi: "10.1007/s13300-026-01920-1",
      }),
    ).toBe(false);
    expect(
      pmcRecordMatchesArticle(pmcXml, {
        pmid: "31898479",
        doi: "10.1186/s12933-019-0977-z",
      }),
    ).toBe(true);
  });
});

describe("organization filter", () => {
  test("does not treat English 'who' as WHO", () => {
    expect(
      organizationFilterMatches("WHO", {
        organization:
          "ISH Africa guideline authors who deliver most of the primary care",
        title: "Hypertension guideline",
        abstract: "Clinicians who deliver most of the primary care",
        journal: "Journal of Hypertension",
      }),
    ).toBe(false);
  });

  test("matches actual WHO guidelines", () => {
    expect(
      organizationFilterMatches("WHO", {
        organization: "World Health Organization",
        title: "WHO guideline on hypertension",
        journal: "WHO",
      }),
    ).toBe(true);
  });

  test("matches ISTH and CHEST by alias, not by truncated prefixes", () => {
    expect(
      organizationFilterMatches("ISTH", {
        organization: "International Society on Thrombosis and Haemostasis",
        title: "guidance from the SSC of the ISTH",
      }),
    ).toBe(true);
    expect(
      organizationFilterMatches("American College of Chest Physicians", {
        organization: "American College of Chest Physicians",
        title: "CHEST Guideline and Expert Panel Report",
      }),
    ).toBe(true);
    expect(
      organizationFilterMatches("American College of Chest Physicians", {
        organization: "American College",
        title: "Unrelated",
      }),
    ).toBe(false);
  });
});

describe("organization extraction", () => {
  test("keeps the longest organisation name, not a prefix", () => {
    expect(
      extractOrganizationName(
        "Antithrombotic Therapy for Atrial Fibrillation: CHEST Guideline and Expert Panel Report",
        "The American College of Chest Physicians recommends anticoagulation for atrial fibrillation.",
      ),
    ).toBe("American College of Chest Physicians");
    expect(
      extractOrganizationName(
        "Stroke Prevention in Atrial Fibrillation Contemporary International Guidelines",
        "Comparison of the European Society of Cardiology (ESC) and AHA/ACC recommendations.",
      ),
    ).toContain("European Society of Cardiology");
    expect(
      extractOrganizationName(
        "Anticoagulation for stroke prevention in atrial fibrillation: guidance from the SSC of the ISTH",
      ),
    ).toBe("International Society on Thrombosis and Haemostasis");
    expect(
      extractOrganizationName(
        "Canadian Heart Rhythm Society position statement on anticoagulation",
      ),
    ).toBe("Canadian Heart Rhythm Society");
    expect(
      extractOrganizationName(
        "The Society of Thoracic Surgeons practice guideline",
      ),
    ).toBe("Society of Thoracic Surgeons");
  });

  test("does not treat HRS in a slash-list as Heart Rhythm Society", () => {
    expect(
      extractOrganizationName(
        "EHRA/HRS/APHRS/LAHRS expert consensus statement on arrhythmias",
      ),
    ).not.toBe("Heart Rhythm Society");
    expect(
      extractOrganizationName(
        "SCAI/HRS expert consensus statement on transcatheter left atrial appendage closure",
      ),
    ).not.toBe("Heart Rhythm Society");
    expect(
      extractOrganizationName(
        "Heart Rhythm Society expert consensus statement on arrhythmias",
      ),
    ).toBe("Heart Rhythm Society");
  });

  test("does not treat English who as WHO", () => {
    expect(
      extractOrganizationName(
        "Hypertension guideline",
        "Clinicians who deliver most of the primary care",
      ),
    ).toBe("Unknown Organization");
  });
});

describe("AAP URL allowlist", () => {
  test("rejects off-domain and homepage-only results", () => {
    expect(isAllowedAapUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
    expect(isAllowedAapUrl("https://www.mayoclinic.org/fever")).toBe(false);
    expect(isAllowedAapUrl("https://www.aap.org/")).toBe(false);
    expect(
      isAllowedAapUrl(
        "https://publications.aap.org/pediatrics/article/150/1/e2022057990",
      ),
    ).toBe(true);
  });

  test("classifies from URL and title, not from which search ran", () => {
    const policy = classifyAapResult(
      "https://publications.aap.org/pediatrics/article/policy-statement",
      "Sleep-Related Infant Deaths: AAP Policy Statement",
    );
    expect(policy.category).toBe("Policy Statement");
    const bright = classifyAapResult(
      "https://brightfutures.aap.org/materials-and-tools/",
      "Bright Futures Guidelines",
    );
    expect(bright.source).toBe("bright-futures");
  });
});

describe("helpers", () => {
  test("decodes HTML entities", () => {
    expect(decodeHtmlEntities("A &amp; B")).toBe("A & B");
  });

  test("validates PMIDs", () => {
    expect(isValidPmid("42742671")).toBe(true);
    expect(isValidPmid("not-a-pmid")).toBe(false);
  });

  test("quotes multi-word queries", () => {
    expect(quoteMultiWordQuery("long COVID")).toBe('"long COVID"');
    expect(quoteMultiWordQuery("metformin")).toBe("metformin");
  });

  test("dedupes simultaneous journal publications of the same guideline", () => {
    const jacc = {
      title:
        "2023 ACC/AHA/ACCP/HRS Guideline for the Diagnosis and Management of Atrial Fibrillation",
      doi: "10.1016/j.jacc.2023.08.017",
    };
    const circulation = {
      title:
        "2023 ACC/AHA/ACCP/HRS Guideline for the Diagnosis and Management of Atrial Fibrillation: A Report of the American College of Cardiology/American Heart Association Joint Committee on Clinical Practice Guidelines",
      doi: "10.1161/CIR.0000000000001193",
    };
    expect(sameGuideline(jacc, circulation)).toBe(true);
    expect(
      sameGuideline(jacc, {
        title: jacc.title,
        doi: "https://doi.org/10.1016/j.jacc.2023.08.017",
      }),
    ).toBe(true);
    expect(
      sameGuideline(jacc, {
        title:
          "2014 AHA/ACC/HRS Guideline for the Management of Patients With Atrial Fibrillation",
      }),
    ).toBe(false);
  });

  test("maps WHO sex dimensions and sorts years descending", () => {
    const mapped = mapWhoDataValue(
      {
        SpatialDim: "AUS",
        TimeDim: 2021,
        NumericValue: 71.08333,
        Dim1Type: "SEX",
        Dim1: "FMLE",
        Unit: "years",
      },
      {
        IndicatorCode: "WHOSIS_000002",
        IndicatorName: "Healthy life expectancy",
      },
    );
    expect(mapped?.IndicatorName).toBe("Healthy life expectancy");
    expect(mapped?.Sex).toBe("Female");
    expect(String(mapped?.Value)).toBe("71.08 years");
    const inferred = mapWhoDataValue(
      {
        SpatialDim: "USA",
        TimeDim: 2021,
        NumericValue: 76.37,
        Dim1: "BTSX",
      },
      {
        IndicatorCode: "WHOSIS_000001",
        IndicatorName: "Life expectancy at birth",
      },
    );
    expect(inferred?.Sex).toBe("Both sexes");
    const snapshot = latestWhoSnapshot([
      { IndicatorCode: "A", TimeDim: "2020", Sex: "Both sexes" },
      { IndicatorCode: "A", TimeDim: "2021", Sex: "Male" },
      { IndicatorCode: "A", TimeDim: "2021", Sex: "Female" },
      { IndicatorCode: "B", TimeDim: "2019" },
    ]);
    expect(snapshot).toEqual([
      { IndicatorCode: "A", TimeDim: "2021", Sex: "Male" },
      { IndicatorCode: "A", TimeDim: "2021", Sex: "Female" },
      { IndicatorCode: "B", TimeDim: "2019" },
    ]);
    const sorted = sortWhoValues([
      { TimeDim: "2012" },
      { TimeDim: "1995" },
      { TimeDim: "2024" },
    ]);
    expect(sorted.map((row) => row.TimeDim)).toEqual(["2024", "2012", "1995"]);
  });

  test("does not grade study protocols as RCTs", () => {
    const tag = classifyEvidence(
      "TIGHTEN: a randomized controlled trial protocol",
      "This study protocol describes a randomized trial.",
    );
    expect(tag.studyType).toBe("Study Protocol");
  });

  test("grades JAMA narrative reviews as Grade V even when the abstract cites RCTs", () => {
    const diabetes = classifyEvidence(
      "Diagnosis and Treatment of Type 2 Diabetes in Adults: A Review",
      "Randomized clinical trials have reported absolute reductions in microvascular disease. Several randomized clinical trials have demonstrated benefits of SGLT2i medications. Most trial participants with type 2 diabetes were taking metformin.",
    );
    expect(diabetes).toMatchObject({
      studyType: "Narrative Review",
      grade: "V",
    });
    const angina = classifyEvidence(
      "Diagnosis and Management of Stable Angina: A Review",
      "Randomized clinical trials showed no improvement in the rates of mortality or myocardial infarction with revascularization compared with optimal medical therapy alone.",
    );
    expect(angina).toMatchObject({
      studyType: "Narrative Review",
      grade: "V",
    });
  });
});
