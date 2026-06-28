import type { LetterState } from '../types';
import { rankByGrade } from '../data/ranks';
import { SEAL_URL } from '../format/seals';

// Underlined fill-in blank: shows the value, or a grey hint that is hidden on print
// (so the printed form has an empty underlined blank to write on).
function Fill({ v, ph, grow }: { v: string; ph?: string; grow?: boolean }) {
  return (
    <span className={grow ? 'nfill grow' : 'nfill'}>
      {v.trim() ? v : <span className="nph">{ph ?? ''}</span>}
    </span>
  );
}

// Page 2 — reverse-side instructions, verbatim (English | French), with the form's own quirks.
const NATO_NOTES: [string, string][] = [
  [
    'This Travel Order is to be used for both individual and collective movement.  When the Travel Order is issued to parties of 20 or over, detailed arrangements are to be made as necessary for movement, reception, staging, etc…',
    "Cet Ordre de mission peut être utilisé à la fois pour les mouvements individuals ou collectifs. Toutefois, lorsqu'il sera utilisé pour de détachements égaux ou supérieurs à 20 hommes, des mesures de détail devront être prises si nécessaire par tous les organismes chargés de leur de leur réception et de leur séjour, etc…",
  ],
  [
    'This Travel Order is to be produced to civil and military authorities on request.',
    'Cet Ordre de mission devra etre presenté sur demande des Autorités civiles et militaires.',
  ],
  [
    'It is not to be used for civilian personnel.',
    'Cet Ordre de mission ne sera pas utilisé pour les personnels civils.',
  ],
  [
    'The country from which travel is authorized and the country (countries) to and through which travel is authorized must be included in paragraph 2.  The inclusion of the location (i.e. town, city) from and to which travel is authorized is optional.',
    "Au paragraphe 2, seule la mention des pays est obligatoire. L'indication de l'endroit exact (ville, lieu...) est facultative.",
  ],
  [
    'Paragraph 3 refers to National Military Authority and may be used if required.',
    'Le paragraphe 3 se réfère à une Autorité militaire nationale et peut être utilisé si besoin est.',
  ],
  [
    'Personnel are to be in possession of Service Identity Documents.',
    "Chaque individu sera porteur d'une pièce d'identité militaire.",
  ],
  [
    'Paragraph 5 should be deleted if not applicable.',
    'Le paragraphe 5 sera supprimé le cas échéant.',
  ],
  [
    'If more than one person is traveling, the list, as referred to in paragraph 1 of the form should show Personal/Identity Card Number (if any), Rank, Name, and Unit.  This list may be shown on the face, on reverse, or on a separate document as appropriate.',
    "S'il s'agit du déplacement de plusieurs individus, la liste indiquée au paragraphe 1 du formulaire devra comporter le numéro matricule ou de la carte d'identité, le grade, le nom et l'unité de chacun d'eux.  Cette list poura figurer soit sur le recto ou le verso de l'Ordre de mission, soit sur un document distinct, selon le ca.",
  ],
  [
    'Any additional details or instructions which issuing nations wish to include should be attached on a separate paper, or on the reverse of the form.',
    "Tous détails ou instructions supplémentaires que la nation d'origine désire inclure devront figurer soit au dos du formulaire, soit sur une feuille séparée.",
  ],
  ['Print the travel order on appropriate organizational letterhead.', ''],
];

export function NatoForm({ state }: { state: LetterState }) {
  const lh = state.letterhead;
  const n = state.nato;
  const rank = rankByGrade(n.rankGrade);
  const sealSrc = SEAL_URL[lh.seal];
  const showLh = lh.mode !== 'off';

  return (
    <>
      {/* ---------- Page 1: the order ---------- */}
      <div className="page nato">
        {showLh && sealSrc && <img className="seal" src={sealSrc} alt="" />}
        {showLh && (
          <div className="letterhead">
            <div className="lh-dept">{lh.line1}</div>
            {lh.activityName ? (
              lh.activityName.split('\n').map((l, i) => (
                <div key={i} className="lh-sub">
                  {l || ' '}
                </div>
              ))
            ) : (
              <div className="lh-sub ph">NAME OF ACTIVITY</div>
            )}
            <div className={lh.addressLine ? 'lh-sub' : 'lh-sub ph'}>
              {lh.addressLine || 'STREET ADDRESS'}
            </div>
            <div className={lh.cityStateZip ? 'lh-sub' : 'lh-sub ph'}>
              {lh.cityStateZip || 'CITY STATE ZIP+4'}
            </div>
          </div>
        )}

        <div className="nato-title">NATO TRAVEL ORDER / ORDRE DE MISSION OTAN</div>

        <div className="nato-cor">
          <div>
            COUNTRY OF ORIGIN: United States of America
            <div className="nfr">PAYS DE PROVENANCE:</div>
          </div>
          <div>
            ORDER NUMBER: <Fill v={n.orderNumber} ph="order no." />
            <div className="nfr">NUMÉRO DE SÉRIE:</div>
          </div>
        </div>

        <div className="nato-p">
          <span className="nato-num">1.</span>
          <div>
            The bearer <i>(and group as shown hereon or on attached list)</i>
            <div className="nfr">
              Le porteur <i>(et personnel porté ci-dessus ou sur la liste jointe)</i>
            </div>
            <div className="nentry">
              {rank?.abbr ? `${rank.abbr} ` : ''}
              {n.name.trim() ? n.name : <span className="nph">full name</span>}
              {', '}
              {rank?.nato ?? ''}
              {', DODID '}
              {n.dodId.trim() ? n.dodId : <span className="nph">DoD ID</span>}
            </div>
            <div className="nlabel">
              Grade or, rank/Grade, Name/Nom, and Personnel ID Card No. (DoD ID Number {'{back of CAC}'})/No Mle
            </div>
          </div>
        </div>

        <div className="nato-p">
          <span className="nato-num">2.</span>
          <div>
            <div className="nrow2">
              <span>
                Will travel from <Fill v={n.from} ph="origin" />
              </span>
              <span>
                to <Fill v={n.to} ph="destination" />
              </span>
            </div>
            <div className="nrow2 nfr">
              <span>Fera mouvement de</span>
              <span>a</span>
            </div>
            <div className="nrow2 nrow2-top">
              <span className="vialine">
                Via <Fill v={n.via} ph="countries traveled to / through" grow />
              </span>
              <span className="nowrap">
                Date of Departure <Fill v={n.departureDate} ph="date" />
              </span>
            </div>
            <div className="nrow2 nfr">
              <span>Via</span>
              <span>Date du depart</span>
            </div>
            <div className="nentry-sp">
              Expected date of return to United States <Fill v={n.returnDate} ph="date" />
            </div>
            <div className="nfr">Date probable de retour</div>
          </div>
        </div>

        <div className="nato-p">
          <span className="nato-num">3.</span>
          <div>
            Authority <span className="uline">{n.armsGranted ? 'is' : 'is not'}</span> granted to
            possess and carry arms.
            <div className="nfr">
              Autorisation de porte d'armes{' '}
              <span className="uline">{n.armsGranted ? 'accordée' : 'non accordé'}</span>.
            </div>
          </div>
        </div>

        <div className="nato-p">
          <span className="nato-num">4.</span>
          <div>
            The person named in paragraph 1 is authorized to carry <Fill v={n.dispatchQty} ph="no/none" />
            <div className="nfr">Le personne indiquée au paragraphe 1 est autorisé à porter</div>
            <div className="nentry-sp">
              sealed dispatches, containing only official documents, numbered{' '}
              <Fill v={n.dispatchNumbers} ph="N/A" />
            </div>
            <div className="nfr">plis scellés, ne contiennent que des documents officials, numerates</div>
          </div>
        </div>

        {n.includeSofa && (
          <div className="nato-p">
            <span className="nato-num">5.</span>
            <div>
              I hereby certify that this individual/group is/are member(s) of a Force as defined in
              the NATO Status of Forces Agreement, and that this is an authorized move under the
              terms of this agreement.
              <div className="nfr">
                Je soussigné certifie que le personnel visé appartient à une armée telle que définie
                dans l'Accord OTAN sur le statut des Forces armées et que ce déplacement et officiel
                selon les termes de ce Accord.
              </div>
            </div>
          </div>
        )}

        <div className="nato-p">
          <span className="nato-num">{n.includeSofa ? '6.' : '5.'}</span>
          <div>
            This travel order is to be produced to civil and military authorities on request.
            <div className="nfr">
              Cet ordre de mission devra etre presente sur demande des autorites civiles et
              militaires.
            </div>
          </div>
        </div>

        <div className="nato-bottom">
          <div className="nb-col">
            <div className="nb-line">
              {n.authorizingOfficer.trim() ? (
                <span className="nb-officer">{n.authorizingOfficer}</span>
              ) : (
                ''
              )}
            </div>
            <div className="nb-cap">OFFICER AUTHORIZING MOVEMENT</div>
            <div className="nfr">OFFICIER AUTORISANT LE MOUVEMENT</div>
          </div>
          <div className="nb-col">
            <div className="nb-line nb-line-date">
              {n.dateOfIssue.trim() ? n.dateOfIssue : <span className="nph">date of issue</span>}
            </div>
            <div className="nb-cap">DATE OF ISSUE</div>
            <div className="nfr">DATE DE L'AUTORISATION</div>
          </div>
        </div>
      </div>

      {/* ---------- Page 2: reverse-side instructions ---------- */}
      <div className="page nato nato-reverse">
        <div className="nato-rev-title">REVERSE SIDE OF NATO TRAVEL ORDER</div>
        <div className="nato-rev-title nfr">[VERSO DE L'ORDRE DE MISSION]</div>
        <div className="nato-rev-sub">SUGGESTED INSTRUCTIONS WHICH MAY BE PUT ON BACK OF FORM</div>
        <div className="nato-rev-sub nfr">
          [PROPOSITIONS D'INSTRUCTIONS POUVANT FIGURER AU DOS DU FORMULAIRE]
        </div>
        <div className="nato-notes">
          {NATO_NOTES.map(([en, fr], i) => (
            <div className="nato-note" key={i}>
              <span className="nato-num">{i + 1}.</span>
              <div className="nn-en">{en}</div>
              <div className="nn-fr">{fr}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
