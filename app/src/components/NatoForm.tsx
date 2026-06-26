import type { ReactNode } from 'react';
import type { LetterState } from '../types';
import { rankByGrade } from '../data/ranks';

// Renders a fill-in value or a grey placeholder when empty.
function F({ v, ph }: { v: string; ph: string }): ReactNode {
  return v.trim() ? <span className="nato-fill">{v}</span> : <span className="ph">{ph}</span>;
}

export function NatoForm({ state }: { state: LetterState }) {
  const lh = state.letterhead;
  const n = state.nato;
  const rank = rankByGrade(n.rankGrade);
  const sealSrc =
    lh.seal === 'dod' ? '/dod-seal-blue.png' : lh.seal === 'don' ? '/don-seal.svg' : null;
  const showLh = lh.mode !== 'off';

  return (
    <div className="page nato">
      {showLh && sealSrc && <img className="seal" src={sealSrc} alt="" />}
      {showLh && (
        <div className="letterhead">
          <div className="lh-dept">{lh.line1}</div>
          <div className={lh.activityName ? 'lh-sub' : 'lh-sub ph'}>
            {lh.activityName || 'NAME OF ACTIVITY'}
          </div>
          <div className={lh.addressLine ? 'lh-sub' : 'lh-sub ph'}>
            {lh.addressLine || 'STREET ADDRESS'}
          </div>
          <div className={lh.cityStateZip ? 'lh-sub' : 'lh-sub ph'}>
            {lh.cityStateZip || 'CITY STATE ZIP+4'}
          </div>
        </div>
      )}

      <div className="nato-title">NATO TRAVEL ORDER / ORDRE DE MISSION OTAN</div>

      <div className="nato-row">
        <div>
          COUNTRY OF ORIGIN: United States of America
          <div className="fr">PAYS DE PROVENANCE:</div>
        </div>
        <div>
          ORDER NUMBER: <F v={n.orderNumber} ph="[order no.]" />
          <div className="fr">NUMÉRO DE SÉRIE:</div>
        </div>
      </div>

      <div className="nato-p">
        <span className="nato-num">1.</span>
        <div>
          The bearer (and group as shown hereon or on attached list)
          <div className="fr">Le porteur (et personnel porté ci-dessus ou sur la liste jointe)</div>
          <div className="nato-entry">
            <F v={rank?.abbr ?? ''} ph="[rank]" /> <F v={n.name} ph="[full name]" />,{' '}
            <F v={rank?.nato ?? ''} ph="[NATO code]" />, DODID <F v={n.dodId} ph="[DoD ID]" />
          </div>
          <div className="fr small">
            Grade or, rank/Grade, Name/Nom, and Personnel ID Card No. (DoD ID Number)/No Mle
          </div>
        </div>
      </div>

      <div className="nato-p">
        <span className="nato-num">2.</span>
        <div>
          Will travel from <F v={n.from} ph="[origin]" /> to <F v={n.to} ph="[destination]" />
          <div className="fr">Fera mouvement de … a</div>
          <div className="nato-entry">
            Via <F v={n.via} ph="[countries traveled to / through]" />
          </div>
          <div className="nato-entry">
            Date of Departure <F v={n.departureDate} ph="[date]" /> &nbsp;·&nbsp; Expected date of
            return to United States <F v={n.returnDate} ph="[date]" />
          </div>
          <div className="fr">Via … Date du départ … Date probable de retour</div>
        </div>
      </div>

      <div className="nato-p">
        <span className="nato-num">3.</span>
        <div>
          Authority <b>{n.armsGranted ? 'is' : 'is not'}</b> granted to possess and carry arms.
          <div className="fr">
            Autorisation de porte d'armes {n.armsGranted ? 'accordée' : 'non accordé'}.
          </div>
        </div>
      </div>

      <div className="nato-p">
        <span className="nato-num">4.</span>
        <div>
          The person named in paragraph 1 is authorized to carry{' '}
          {n.dispatches.trim() ? (
            <span>
              sealed dispatches, containing only official documents,{' '}
              <span className="nato-fill">{n.dispatches}</span>
            </span>
          ) : (
            <b>no/none</b>
          )}
          .
          <div className="fr">
            Le personne indiquée au paragraphe 1 est autorisé à porter … plis scellés …
          </div>
        </div>
      </div>

      {n.includeSofa && (
        <div className="nato-p">
          <span className="nato-num">5.</span>
          <div>
            I hereby certify that this individual/group is/are member(s) of a Force as defined in the
            NATO Status of Forces Agreement, and that this is an authorized move under the terms of
            this agreement.
            <div className="fr">
              Je soussigné certifie que le personnel visé appartient à une armée telle que définie
              dans l'Accord OTAN sur le statut des Forces armées et que ce déplacement est officiel
              selon les termes de cet Accord.
            </div>
          </div>
        </div>
      )}

      <div className="nato-p">
        <span className="nato-num">6.</span>
        <div>
          This travel order is to be produced to civil and military authorities on request.
          <div className="fr">
            Cet ordre de mission devra être présenté sur demande des autorités civiles et militaires.
          </div>
        </div>
      </div>

      <div className="nato-foot">
        <div className="nato-foot-issue">
          <F v={n.dateOfIssue} ph="[date of issue]" />
        </div>
        <div className="nato-foot-row">
          <div>
            <div className="nato-foot-sig">
              {n.authorizingOfficer.trim() ? (
                <span className="nato-fill">{n.authorizingOfficer}</span>
              ) : (
                <span className="ph">[officer authorizing movement]</span>
              )}
            </div>
            <div className="nato-cap">OFFICER AUTHORIZING MOVEMENT</div>
            <div className="fr">OFFICIER AUTORISANT LE MOUVEMENT</div>
          </div>
          <div>
            <div className="nato-cap">DATE OF ISSUE</div>
            <div className="fr">DATE DE L'AUTORISATION</div>
          </div>
        </div>
      </div>
    </div>
  );
}
