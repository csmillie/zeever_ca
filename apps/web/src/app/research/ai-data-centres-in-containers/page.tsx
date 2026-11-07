import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/ai-data-centres-in-containers'

const TITLE = 'AI Data Centres Now Ship in Containers. Municipalities Should Change How They Evaluate Them.'
const DESCRIPTION =
  'NVIDIA’s DSX POD cuts deployment to as little as 14 days. More of the skilled work happens in the factory, and councils still score these projects like factories.'

const IMAGE_URL = '/research/modular-data-centres.webp'
const IMAGE_ALT =
  'A conventional data centre under construction with cranes and crews beside a row of finished modular data centre containers at sunset'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: `https://www.zeever.ca${IMAGE_URL}`, width: 1600, height: 800, alt: IMAGE_ALT }],
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
  },
}

export default function Page() {
  return (
    <BlogPost title={TITLE} description={DESCRIPTION} date="2026-10-21" url={PAGE_URL}>
      <img
        src={IMAGE_URL}
        alt={IMAGE_ALT}
        width={1600}
        height={800}
        className="w-full h-auto rounded-lg"
        fetchPriority="high"
      />

      <p>
        NVIDIA announced its DSX POD architecture today. It&rsquo;s a transportable AI computing facility built around
        the next-generation Vera Rubin hardware, with most of the integration done in a factory before it ships. NVIDIA
        says that cuts deployment at a prepared site from about six months to as little as 14 days.
      </p>
      <p>
        For the operator, that&rsquo;s a great deal. Very expensive GPUs start earning money months sooner, and the
        messy engineering gets standardized.
      </p>
      <p>
        For the town hosting it, I think the deal just got worse, and most economic development offices are still
        scoring these projects the way they&rsquo;d score a factory.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The headline number</h2>
      <p>
        When a company announces a billion-dollar AI data centre, most of that billion is GPUs and the hardware around
        them. Almost none of it is made in the municipality, and most of it isn&rsquo;t made in Canada. You can have a
        huge capital number and very few permanent local jobs attached to it.
      </p>
      <p>
        That doesn&rsquo;t make these projects bad. Data centres pay property tax and they keep skilled trades busy
        during construction. But the total value of a project and the part that stays with residents are two different
        numbers, and the press release only gives you the first one.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What containers change</h2>
      <p>
        Putting a data centre in a shipping container isn&rsquo;t new. Sun Microsystems shipped Project Blackbox in
        2006. What&rsquo;s new is how dense and complete the thing is when it arrives.
      </p>
      <p>
        A conventional build means months of electrical work, cooling integration and commissioning, a lot of it done
        by local contractors. With a factory-integrated pod, much of that happens somewhere else. Local crews still pour
        foundations, run utility connections and in many cases build out serious electrical and cooling capacity. The
        integration work is what moves.
      </p>
      <p>
        I wouldn&rsquo;t read the six-months-to-14-days figure as a matching cut in local labour. Time and labour
        aren&rsquo;t the same measure, and the 14 days assumes the site is already prepared. But the direction is
        obvious. Unless the pods are built nearby, more of the skilled work happens in someone else&rsquo;s community.
      </p>
      <p>
        And permanent employment was already thin. Data centres need a lot of capital and not many people. Monitoring,
        workload management and software operations can all be done remotely, so the on-site team is mostly facilities
        and security. A project that promises 1,000 construction jobs and 50 permanent ones is a very different thing
        from a plant that employs 1,000 people for decades. Both can be worth having. They shouldn&rsquo;t be judged
        with the same spreadsheet.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The real constraint is power</h2>
      <p>
        In Ontario, the scarce resource for a project like this is electricity. High-density AI computing needs a lot of
        capacity, and the municipality may be asked to support new substations, transmission upgrades or water
        infrastructure to make it happen.
      </p>
      <p>
        A megawatt committed to a data centre may not be available, at least for a while, to a housing development or
        another employer that wanted to expand. Maybe the data centre is still the better use. But someone should
        actually make that comparison instead of treating &ldquo;can we accommodate it&rdquo; as the only question.
        Water, noise, backup generators and whether the waste heat could be reused all belong in the same conversation.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What to ask before offering anything</h2>
      <p>
        How many jobs will physically sit in the municipality, counted in person-years for construction and separately
        for permanent roles? How much of the capital spend is imported equipment versus local construction and
        procurement? How many megawatts at peak, and who pays for the upgrades, the developer or the ratepayers? What
        happens to the tax base, and what happens when the hardware is obsolete?
      </p>
      <p>
        The investment split is the one that changes the conversation fastest. A $2 billion project where $1.7 billion
        is imported equipment is nothing like a $2 billion manufacturing investment, even though the headline is
        identical. (Those numbers are illustrative, but councils should be asking for the real breakdown.)
      </p>
      <p>
        The tax question is less obvious. Municipalities need to know how modular equipment will be treated for property
        assessment, because a large announcement doesn&rsquo;t automatically become a large assessed value. Equipment
        that arrived on a truck can leave on one.
      </p>
      <p>
        That last part also matters for the long term. AI hardware turns over in a few years. Containers make upgrades
        easier, and they also make it easier to pull the valuable equipment off a site and leave the concrete, the
        substation and the fence behind. Decommissioning obligations and financial security should be in the agreement
        before anything is approved.
      </p>
      <p>
        Where there are public incentives, the promises should be written into the contract with reporting requirements
        and a way to claw the money back if the jobs or local spending don&rsquo;t show up. &ldquo;Local
        investment&rdquo; should be defined, not assumed.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The Canadian question</h2>
      <p>
        If the chips are made abroad, assembled into pods abroad and run remotely by a company headquartered abroad, the
        host community is mostly providing land and power. That can still be worth doing, especially if the tax revenue
        is real or the capacity ends up serving Canadian researchers.
      </p>
      <p>
        Hosting computing equipment and building an AI industry are two different things, though. The second one
        depends on where the hardware is manufactured, where the systems are engineered and where the people who do
        that work live. (It&rsquo;s the question I keep coming back to with Zeever.ca, my research project on Canadian
        sovereign AI compute.)
      </p>
      <p>
        Municipalities can&rsquo;t fix that on their own. Electricity planning, industrial incentives and national AI
        strategy sit with the province and Ottawa. But the substation goes in a municipality, and so does the empty pad
        when the pods move on.
      </p>
      <p>
        DSX POD is a real engineering accomplishment, and it will make AI capacity faster to deploy everywhere. I
        suspect the result is that councils will see a lot more of these proposals, on much shorter timelines, and the
        ones that already have a scorecard ready will get much better deals than the ones still counting the headline
        number.
      </p>
    </BlogPost>
  )
}
